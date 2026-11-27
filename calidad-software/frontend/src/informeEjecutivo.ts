import type { Informe } from "./agentApi";

type Fallo = {
  id: string;
  titulo: string;
  severidad: string;
  que: string;
  donde: string;
  impacto: string;
  solucion: string;
};

type Requisito = {
  id: string;
  descripcion: string;
  cumple: boolean;
};

export type Reporte = {
  archivo: string;
  markdown: string;
};

function proyectoDe(informe: Informe, dictamen: string): string {
  const pedido = informe.mensajes
    .filter((mensaje) => mensaje.rol === "usuario")
    .map((mensaje) => mensaje.texto)
    .join("\n");
  const github = pedido.match(/github\.com\/[\w.-]+\/([\w.-]+?)(?:\.git)?(?=\s|$)/i);
  if (github?.[1]) {
    return github[1];
  }
  const ruta = pedido.match(/[A-Za-z]:\\[^\r\n"]+|\/[\w .\\/-]+/);
  if (ruta) {
    const partes = ruta[0].replace(/[\\/]+$/, "").split(/[/\\]/);
    const ultimo = partes.at(-1)?.trim();
    if (ultimo) {
      return ultimo;
    }
  }
  const declarado = dictamen.match(/^Proyecto:\s*(.+)$/im);
  return declarado?.[1]?.trim() || "repositorio";
}

const RUIDO = /^(voy a\b|delego\b|el inventario\b|pensando\b|ahora voy\b|primero voy\b|voy a leer\b|voy a revisar\b)/i;

function limpiar(texto: string): string {
  return texto
    .split("\n")
    .filter((linea) => !RUIDO.test(linea.trim()))
    .join("\n")
    .trim();
}

function dictamenDe(informe: Informe): string {
  const candidatos = informe.mensajes.filter(
    (mensaje) => mensaje.rol === "Coordinador" && /veredicto|informe ejecutivo/i.test(mensaje.texto),
  );
  const elegido = candidatos.at(-1)?.texto ?? "";
  const marcas = [...elegido.matchAll(/^##\s+Informe ejecutivo\b.*$/gim)];
  if (marcas.length === 0) {
    return limpiar(elegido);
  }
  const inicio = marcas[0]?.index ?? 0;
  const fin = marcas.length > 1 ? (marcas[1]?.index ?? elegido.length) : elegido.length;
  return limpiar(elegido.slice(inicio, fin));
}

function unSoloInforme(markdown: string): string {
  const lineas = markdown.split("\n");
  let vistos = 0;
  const salida: string[] = [];
  for (const linea of lineas) {
    if (/^#{1,3}\s+Informe ejecutivo\b/i.test(linea.trim())) {
      vistos += 1;
      if (vistos > 1) {
        break;
      }
    }
    salida.push(linea);
  }
  return salida.join("\n").trimEnd() + "\n";
}

function linea(texto: string, etiqueta: string): string {
  const encontrada = texto.match(new RegExp(`^${etiqueta}:\\s*(.+)$`, "im"));
  return encontrada?.[1]?.trim() ?? "";
}

function bloque(texto: string, inicio: string, fin: string): string {
  const desde = texto.search(new RegExp(`^###\\s+${inicio}`, "im"));
  if (desde < 0) {
    return "";
  }
  const resto = texto.slice(desde);
  const corte = resto.slice(4).search(new RegExp(`^###\\s+${fin}`, "im"));
  return corte < 0 ? resto : resto.slice(0, corte + 4);
}

function veredictoDe(texto: string): { etiqueta: string; codigo: string } {
  const crudo = linea(texto, "Veredicto").toLowerCase();
  if (crudo.includes("fail")) {
    return { etiqueta: "REPROBADO / FAIL", codigo: "fail" };
  }
  if (crudo.includes("risk")) {
    return { etiqueta: "APROBADO CON RIESGOS / PASS WITH RISKS", codigo: "pass_with_risks" };
  }
  if (crudo.includes("pass")) {
    return { etiqueta: "APROBADO / PASS", codigo: "pass" };
  }
  return { etiqueta: "SIN VEREDICTO", codigo: "" };
}

function motivoDe(texto: string): string {
  const motivo = linea(texto, "Motivo");
  if (!motivo) {
    return "El dictamen no incluyó un motivo en dos líneas.";
  }
  const frases = motivo.split(/(?<=\.)\s+/).filter(Boolean);
  return frases.slice(0, 2).join(" ");
}

function metricasDe(texto: string, requisitos: Requisito[]): { total: number; cumplen: number; fallan: number } {
  const crudo = linea(texto, "Criterios");
  const numeros = crudo.match(/\d+/g)?.map(Number) ?? [];
  if (numeros.length >= 3) {
    return { total: numeros[0] ?? 0, cumplen: numeros[1] ?? 0, fallan: numeros[2] ?? 0 };
  }
  const fallan = requisitos.filter((requisito) => !requisito.cumple).length;
  return { total: requisitos.length, cumplen: requisitos.length - fallan, fallan };
}

function campo(bloqueFallo: string, nombre: string): string {
  const encontrada = bloqueFallo.match(new RegExp(`^${nombre}:\\s*([\\s\\S]*?)(?=\\n(?:Qué|Dónde|Impacto|Solución):|$)`, "im"));
  return encontrada?.[1]?.replace(/\s+/g, " ").trim() || "No indicado en el dictamen.";
}

function fallosDe(texto: string): Fallo[] {
  const seccion = bloque(texto, "Fallos", "Pruebas");
  const partes = seccion.split(/^####\s+/m).slice(1);
  return partes.map((parte, indice) => {
    const [cabeza, ...resto] = parte.split("\n");
    const cuerpo = resto.join("\n");
    const titulo = cabeza?.split("|")[0]?.replace(/^H\d+\.\s*/, "").trim() || `Fallo ${indice + 1}`;
    const severidad = /alta/i.test(cabeza ?? "") ? "Alta" : /baja/i.test(cabeza ?? "") ? "Baja" : "Media";
    return {
      id: `H${indice + 1}`,
      titulo,
      severidad,
      que: campo(cuerpo, "Qué"),
      donde: campo(cuerpo, "Dónde"),
      impacto: campo(cuerpo, "Impacto"),
      solucion: campo(cuerpo, "Solución"),
    };
  });
}

function requisitosDe(texto: string): Requisito[] {
  const seccion = bloque(texto, "Requisitos", "Observaciones");
  return seccion
    .split("\n")
    .map((fila) => fila.trim())
    .filter((fila) => {
      if (!fila.startsWith("|")) {
        return false;
      }
      const celdas = fila.split("|").map((celda) => celda.trim()).filter(Boolean);
      return celdas.length >= 2 && celdas[0] !== "ID" && !/^[-:| ]+$/.test(celdas[0] ?? "");
    })
    .map((fila) => {
      const celdas = fila.split("|").map((celda) => celda.trim()).filter(Boolean);
      const estado = (celdas[2] ?? "").toLowerCase();
      return {
        id: celdas[0] ?? "R",
        descripcion: celdas[1] ?? "Requisito",
        cumple: estado.includes("cumple") && !estado.includes("incumple"),
      };
    });
}

function listaDe(texto: string, seccion: string, siguiente: string): string[] {
  const cuerpo = bloque(texto, seccion, siguiente);
  return cuerpo
    .split("\n")
    .map((lineaTexto) => lineaTexto.replace(/^[-*]\s*/, "").trim())
    .filter((lineaTexto) => lineaTexto && !lineaTexto.startsWith("#") && !/^existen:/i.test(lineaTexto) && !/^faltan:/i.test(lineaTexto));
}

function pruebasDe(texto: string): { existen: string; faltan: string } {
  const seccion = bloque(texto, "Pruebas", "Requisitos");
  return {
    existen: linea(seccion, "Existen") || "El dictamen no describió las pruebas existentes.",
    faltan: linea(seccion, "Faltan") || "El dictamen no indicó casos faltantes.",
  };
}

function pasosDe(solucion: string): string {
  const partes = solucion
    .split(/\s*(?=\d+[.)\]]\s+)/)
    .map((paso) => paso.replace(/^\d+[.)\]]\s*/, "").trim())
    .filter(Boolean);
  if (partes.length < 2) {
    return solucion;
  }
  return partes.map((paso, indice) => `${indice + 1}. ${paso}`).join(" ");
}

function slug(nombre: string): string {
  const limpio = nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return limpio.slice(0, 48) || "repositorio";
}

export function construirReporte(informe: Informe, ahora = new Date()): Reporte {
  const dictamen = dictamenDe(informe);
  const fecha = ahora.toLocaleString("es-CO", { hour12: false });
  const dia = ahora.toISOString().slice(0, 10);
  if (!/veredicto|informe ejecutivo/i.test(dictamen)) {
    return {
      archivo: `reporte-calidad-repositorio-${dia}.md`,
      markdown: [
        `# Informe ejecutivo de hallazgos y soluciones`,
        ``,
        `- **Fecha y hora:** ${fecha}`,
        `- **Sesión:** ${informe.sesionId ?? "sin sesión"}`,
        `- **Veredicto final:** SIN VEREDICTO`,
        ``,
        `El coordinador todavía no cerró el informe ejecutivo de esta sesión.`,
        ``,
      ].join("\n"),
    };
  }
  const proyecto = proyectoDe(informe, dictamen);
  const veredicto = veredictoDe(dictamen);
  const fallos = fallosDe(dictamen);
  const requisitos = requisitosDe(dictamen);
  const metricas = metricasDe(dictamen, requisitos);
  const pruebas = pruebasDe(dictamen);
  const observaciones = listaDe(dictamen, "Observaciones", "$").filter((item) => !RUIDO.test(item));
  const fallosTexto =
    fallos.length === 0
      ? "No se encontraron fallos."
      : fallos
          .map(
            (fallo) =>
              `### ${fallo.id}. ${fallo.titulo}\n\n- **Severidad:** ${fallo.severidad}\n- **¿Qué está fallando?** ${fallo.que}\n- **Archivo y función:** ${fallo.donde}\n- **Impacto en el usuario o negocio:** ${fallo.impacto}\n- **¿Cómo solucionarlo?** ${pasosDe(fallo.solucion)}`,
          )
          .join("\n\n");
  const tabla =
    requisitos.length === 0
      ? "El dictamen no trajo una tabla de requisitos."
      : ["| ID | Criterio | Estado |", "| --- | --- | --- |", ...requisitos.map((requisito) => `| ${requisito.id} | ${requisito.descripcion} | ${requisito.cumple ? "Cumple" : "Incumple"} |`)].join("\n");
  const observacionesTexto = observaciones.length === 0 ? "- Sin observaciones adicionales." : observaciones.map((item) => `- ${item}`).join("\n");
  const markdown = [
    `# Informe ejecutivo de hallazgos y soluciones`,
    ``,
    `- **Proyecto:** ${proyecto}`,
    `- **Fecha y hora:** ${fecha}`,
    `- **Sesión:** ${informe.sesionId ?? "sin sesión"}`,
    `- **Veredicto final:** ${veredicto.etiqueta}`,
    `- **Motivo:** ${motivoDe(dictamen)}`,
    `- **Métricas:** ${metricas.total} criterios evaluados, ${metricas.cumplen} cumplen, ${metricas.fallan} fallan.`,
    ``,
    `## Resumen de fallos detectados`,
    ``,
    fallosTexto,
    ``,
    `## Estado de pruebas automatizadas (QA)`,
    ``,
    `- **Qué existe:** ${pruebas.existen}`,
    `- **Qué falta:** ${pruebas.faltan}`,
    ``,
    `## Tabla resumen de requisitos evaluados`,
    ``,
    tabla,
    ``,
    `## Observaciones y mejoras opcionales`,
    ``,
    observacionesTexto,
    ``,
  ].join("\n");
  return { archivo: `reporte-calidad-${slug(proyecto)}-${dia}.md`, markdown: unSoloInforme(markdown) };
}
