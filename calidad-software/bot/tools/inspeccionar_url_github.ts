import { defineTool } from "@grok/agent-sdk/tools";
import { repositorioDe, usarClon } from "../lib/clon-temporal";
import { analizarYGuardar } from "../lib/duplicados-codigo";
import { ramaSchema, urlGithubSchema } from "../lib/entrada";
import { inventariarDirectorio } from "../lib/escaneo";
import * as z from "zod/v4";

export { repositorioDe };

export default defineTool({
  description:
    "Clona en solo lectura una URL https://github.com/usuario/repositorio con git clone --depth 1, inventaría el árbol completo y borra el clon en un finally. No hace push, commit, pull request ni comentarios. Calcula la duplicación real antes de borrar el clon.",
  effect: "read",
  inputSchema: z.object({
    url: urlGithubSchema,
    branch: ramaSchema.optional().describe("Rama a clonar. Si se omite, se usa la rama predeterminada."),
  }),
  async execute({ url, branch }) {
    const repo = repositorioDe(url);
    if (!repo) {
      return { ok: false as const, motivo: "url_invalida" };
    }
    const origen = `https://github.com/${repo.owner}/${repo.repo}`;
    const clon = await usarClon(origen, branch, async (destino) => {
      const inventario = await inventariarDirectorio(destino);
      const duplicacion = await analizarYGuardar(destino, origen);
      return { inventario, duplicacion };
    });
    if (!clon.ok) {
      return { ok: false as const, motivo: clon.motivo, origen, detalle: clon.detalle };
    }
    return {
      ok: true as const,
      origen,
      rama: branch ?? "predeterminada",
      lectura: "solo_lectura" as const,
      persistencia: "clon_temporal_eliminado" as const,
      ...clon.valor.inventario,
      duplicacion: clon.valor.duplicacion,
    };
  },
});
