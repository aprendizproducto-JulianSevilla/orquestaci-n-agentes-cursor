import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { repositorioDe, usarClon } from "../lib/clon-temporal";
import { conRepositorio, elegirEntrada } from "../lib/entrada";
import { esSecreto, rutaDentro } from "../lib/rutas";

const MAX_LINEAS = 400;
const MAX_BYTES = 1_000_000;

async function leer(raiz: string, relativo: string, desde?: number, hasta?: number) {
  if (esSecreto(relativo)) {
    return { ok: false as const, motivo: "secreto" as const };
  }
  const full = rutaDentro(raiz, relativo);
  if (!full) {
    return { ok: false as const, motivo: "ruta_fuera_del_repositorio" as const };
  }
  let info;
  try {
    info = await stat(full);
  } catch {
    return { ok: false as const, motivo: "no_existe" as const, archivo: relativo };
  }
  if (!info.isFile()) {
    return { ok: false as const, motivo: "no_es_archivo" as const, archivo: relativo };
  }
  if (info.size > MAX_BYTES) {
    return { ok: false as const, motivo: "demasiado_grande" as const, archivo: relativo, bytes: info.size };
  }
  const cuerpo = await readFile(full, "utf8");
  if (cuerpo.includes("\0")) {
    return { ok: false as const, motivo: "binario" as const, archivo: relativo };
  }
  const filas = cuerpo.split(/\r?\n/);
  const inicio = desde ?? 1;
  const finPedido = hasta ?? inicio + MAX_LINEAS - 1;
  if (finPedido < inicio) {
    return { ok: false as const, motivo: "rango_invalido" as const, archivo: relativo };
  }
  const fin = Math.min(finPedido, inicio + MAX_LINEAS - 1, filas.length);
  const seleccion = filas.slice(inicio - 1, fin).map((linea, indice) => `${inicio + indice}|${linea}`);
  return {
    ok: true as const,
    archivo: relativo,
    desde: inicio,
    hasta: fin,
    lineasTotales: filas.length,
    truncado: fin < Math.min(finPedido, filas.length),
    contenido: seleccion.join("\n"),
  };
}

export default defineTool({
  description:
    "Lee el texto exacto de un archivo del repositorio, con números de línea. Pasa ruta absoluta y archivo relativo, o url de GitHub y archivo. desde y hasta son líneas inclusivas, como máximo 400. No lee secretos. Si la entrada es una URL, clona, lee y borra el clon.",
  effect: "read",
  inputSchema: conRepositorio({
    archivo: z.string().trim().min(1).optional().describe("Ruta relativa del archivo dentro del repositorio."),
    desde: z.number().int().min(1).max(200_000).optional().describe("Primera línea, inclusiva."),
    hasta: z.number().int().min(1).max(200_000).optional().describe("Última línea, inclusiva."),
  }),
  async execute({ ruta, url, branch, archivo, desde, hasta }) {
    const entrada = elegirEntrada({ ruta, url });
    if (!entrada.ok) {
      return { ok: false as const, motivo: entrada.motivo };
    }
    if (entrada.tipo === "url") {
      const urlElegida = entrada.url;
      if (!archivo) {
        return { ok: false as const, motivo: "falta_archivo" };
      }
      const repo = repositorioDe(urlElegida);
      if (!repo) {
        return { ok: false as const, motivo: "url_invalida" };
      }
      const origen = `https://github.com/${repo.owner}/${repo.repo}`;
      const clon = await usarClon(origen, branch, (destino) => leer(destino, archivo, desde, hasta));
      if (!clon.ok) {
        return { ok: false as const, motivo: clon.motivo, detalle: clon.detalle };
      }
      return clon.valor;
    }
    const raiz = resolve(entrada.ruta);
    let info;
    try {
      info = await stat(raiz);
    } catch {
      return { ok: false as const, motivo: "no_existe", ruta: raiz };
    }
    if (info.isFile()) {
      const relativo = archivo ?? raiz.split(/[/\\]/).pop() ?? "";
      const carpeta = resolve(raiz, "..");
      return leer(carpeta, relativo, desde, hasta);
    }
    if (!archivo) {
      return { ok: false as const, motivo: "falta_archivo" };
    }
    return leer(raiz, archivo, desde, hasta);
  },
});
