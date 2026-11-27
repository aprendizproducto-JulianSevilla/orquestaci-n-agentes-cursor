import type { Reporte } from "./informeEjecutivo";

const EXTRA: Record<string, number> = {
  á: 0xe1, é: 0xe9, í: 0xed, ó: 0xf3, ú: 0xfa, ñ: 0xf1, ü: 0xfc,
  Á: 0xc1, É: 0xc9, Í: 0xcd, Ó: 0xd3, Ú: 0xda, Ñ: 0xd1, Ü: 0xdc,
  "¿": 0xbf, "¡": 0xa1, "°": 0xb0, "º": 0xba, "ª": 0xaa,
  "«": 0xab, "»": 0xbb, "“": 0x93, "”": 0x94, "‘": 0x91, "’": 0x92,
  "—": 0x97, "–": 0x96, "…": 0x85, "•": 0x95,
};

type Trazo = { texto: string; tam: number; negrita: boolean };

function winAnsi(texto: string): string {
  const limpio = texto.replaceAll("✅", "[ok]").replaceAll("❌", "[x]");
  let salida = "";
  for (const char of limpio) {
    const especial = EXTRA[char];
    if (especial !== undefined) {
      salida += String.fromCharCode(especial);
      continue;
    }
    const codigo = char.codePointAt(0) ?? 63;
    salida += codigo >= 32 && codigo <= 126 ? char : "?";
  }
  return salida;
}

function escapar(texto: string): string {
  return winAnsi(texto).replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function envolver(texto: string, max: number): string[] {
  if (texto.length <= max) {
    return [texto];
  }
  const lineas: string[] = [];
  let actual = "";
  for (const palabra of texto.split(" ")) {
    if (palabra.length > max) {
      if (actual) {
        lineas.push(actual);
      }
      for (let i = 0; i < palabra.length; i += max) {
        lineas.push(palabra.slice(i, i + max));
      }
      actual = "";
      continue;
    }
    const candidato = actual ? `${actual} ${palabra}` : palabra;
    if (candidato.length > max && actual) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = candidato;
    }
  }
  if (actual) {
    lineas.push(actual);
  }
  return lineas.length > 0 ? lineas : [""];
}

function trazosDe(markdown: string): Trazo[] {
  const salida: Trazo[] = [];
  for (const cruda of markdown.split("\n")) {
    const linea = cruda.trimEnd();
    if (!linea.trim()) {
      salida.push({ texto: "", tam: 11, negrita: false });
      continue;
    }
    if (linea.startsWith("# ")) {
      salida.push({ texto: linea.slice(2), tam: 16, negrita: true });
      continue;
    }
    if (linea.startsWith("## ")) {
      salida.push({ texto: linea.slice(3), tam: 13, negrita: true });
      continue;
    }
    if (linea.startsWith("### ")) {
      salida.push({ texto: linea.slice(4), tam: 12, negrita: true });
      continue;
    }
    const tam = linea.trim().startsWith("|") ? 8 : 11;
    const max = tam === 8 ? 110 : 92;
    for (const trozo of envolver(linea, max)) {
      salida.push({ texto: trozo, tam, negrita: false });
    }
  }
  return salida;
}

function paginar(trazos: Trazo[]): Trazo[][] {
  const paginas: Trazo[][] = [];
  let actual: Trazo[] = [];
  let y = 800;
  for (const trazo of trazos) {
    const alto = trazo.texto === "" ? 8 : trazo.tam + 5;
    if (y - alto < 48 && actual.length > 0) {
      paginas.push(actual);
      actual = [];
      y = 800;
    }
    actual.push(trazo);
    y -= alto;
  }
  if (actual.length > 0) {
    paginas.push(actual);
  }
  return paginas.length > 0 ? paginas.slice(0, 40) : [[{ texto: "Informe ejecutivo", tam: 16, negrita: true }]];
}

function flujo(trazos: Trazo[]): string {
  let y = 800;
  const partes = ["BT"];
  for (const trazo of trazos) {
    const alto = trazo.texto === "" ? 8 : trazo.tam + 5;
    partes.push(trazo.negrita ? `/F2 ${trazo.tam} Tf` : `/F1 ${trazo.tam} Tf`);
    partes.push(`1 0 0 1 48 ${y.toFixed(2)} Tm`);
    partes.push(`(${escapar(trazo.texto)}) Tj`);
    y -= alto;
  }
  partes.push("ET");
  return partes.join("\n");
}

export function construirPdf(markdown: string): Uint8Array {
  const paginas = paginar(trazosDe(markdown));
  const objetos: string[] = [];
  const kids = paginas.map((_, indice) => `${5 + indice * 2} 0 R`).join(" ");
  objetos.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objetos.push(`2 0 obj\n<< /Type /Pages /Count ${paginas.length} /Kids [${kids}] >>\nendobj\n`);
  objetos.push("3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n");
  objetos.push("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n");
  paginas.forEach((pagina, indice) => {
    const contenido = flujo(pagina);
    const paginaId = 5 + indice * 2;
    const contenidoId = paginaId + 1;
    objetos.push(
      `${paginaId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contenidoId} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>\nendobj\n`,
    );
    objetos.push(`${contenidoId} 0 obj\n<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream\nendobj\n`);
  });
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const objeto of objetos) {
    offsets.push(pdf.length);
    pdf += objeto;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i += 1) {
    bytes[i] = pdf.charCodeAt(i) & 0xff;
  }
  return bytes;
}

export function descargarPdf(reporte: Reporte) {
  const bytes = construirPdf(reporte.markdown);
  const copia = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copia).set(bytes);
  const archivo = new Blob([copia], { type: "application/pdf" });
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(archivo);
  enlace.download = reporte.archivo.replace(/\.md$/, ".pdf");
  enlace.click();
  URL.revokeObjectURL(enlace.href);
}
