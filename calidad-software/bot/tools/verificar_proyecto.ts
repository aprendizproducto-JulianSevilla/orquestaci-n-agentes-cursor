import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { defineTool } from "@grok/agent-sdk/tools";
import { repositorioDe, usarClon } from "../lib/clon-temporal";
import { conRepositorio, elegirEntrada } from "../lib/entrada";
import { verificarDirectorio } from "../lib/verificar-proyecto";

export default defineTool({
  description:
    "Ejecuta en sandbox las verificaciones que el proyecto soporta: tsc --noEmit si hay tsconfig y TypeScript local, y npm test si el script existe, es válido y las dependencias están instaladas. Corta por tiempo, guarda stdout y stderr y no instala paquetes. Si recibe una URL, clona, verifica y borra el clon.",
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
      const clon = await usarClon(origen, branch, (destino) => verificarDirectorio(destino, origen));
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
    const verificacion = await verificarDirectorio(raiz, raiz);
    return { ok: true as const, ...verificacion };
  },
});