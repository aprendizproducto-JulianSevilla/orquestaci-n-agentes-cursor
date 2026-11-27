import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { defineTool } from "@grok/agent-sdk/tools";
import { repositorioDe, usarClon } from "../lib/clon-temporal";
import { analizarYGuardar } from "../lib/duplicados-codigo";
import { conRepositorio, elegirEntrada } from "../lib/entrada";

export default defineTool({
  description:
    "Calcula duplicación real de código con ventanas de 6 líneas normalizadas y hash SHA-256. Devuelve porcentaje, líneas duplicadas, archivos afectados y bloques con ruta y rango. No estima. Guarda el resultado para la pestaña Duplicados. Si recibe una URL, clona, analiza y borra el clon.",
  effect: "read",
  inputSchema: conRepositorio({}),
  async execute({ ruta, url, branch }) {
    const entrada = elegirEntrada({ ruta, url });
    if (!entrada.ok) {
      return { ok: false as const, motivo: entrada.motivo };
    }
    if (entrada.tipo === "url") {
      const repo = repositorioDe(entrada.url);
      if (!repo) {
        return { ok: false as const, motivo: "url_invalida" };
      }
      const origen = `https://github.com/${repo.owner}/${repo.repo}`;
      const clon = await usarClon(origen, branch, (destino) => analizarYGuardar(destino, origen));
      if (!clon.ok) {
        return { ok: false as const, motivo: clon.motivo, origen, detalle: clon.detalle };
      }
      return { ok: true as const, ...clon.valor };
    }
    const raiz = resolve(entrada.ruta);
    let info;
    try {
      info = await stat(raiz);
    } catch {
      return { ok: false as const, motivo: "no_existe", ruta: raiz };
    }
    if (!info.isDirectory()) {
      return { ok: false as const, motivo: "no_es_directorio", ruta: raiz };
    }
    const analisis = await analizarYGuardar(raiz, raiz);
    return { ok: true as const, ...analisis };
  },
});
