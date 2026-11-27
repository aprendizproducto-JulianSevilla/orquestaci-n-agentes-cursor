import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { analizarYGuardar } from "../lib/duplicados-codigo";
import { inventariarDirectorio } from "../lib/escaneo";

export { inventariarDirectorio };

export default defineTool({
  description:
    "Inventaría un repositorio local sin cortar el árbol en 80 archivos. Recorre todo el disco salvo node_modules, secretos y artefactos. Devuelve el árbol completo, la configuración de la raíz y de CI, y el detalle ordenado: configuración, código en src/app/lib y después las pruebas. Si el detalle viene truncado, las rutas siguen en arbol. También calcula la duplicación real y la guarda.",
  effect: "read",
  inputSchema: z.object({
    ruta: z.string().min(1).describe("Ruta absoluta de la raíz del repositorio."),
  }),
  async execute({ ruta }) {
    const raiz = resolve(ruta);
    let info;
    try {
      info = await stat(raiz);
    } catch {
      return { ok: false as const, motivo: "no_existe", ruta: raiz };
    }
    if (!info.isDirectory()) {
      return { ok: false as const, motivo: "no_es_directorio", ruta: raiz };
    }
    const inventario = await inventariarDirectorio(raiz);
    const duplicacion = await analizarYGuardar(raiz, raiz);
    return { ok: true as const, raiz, ...inventario, duplicacion };
  },
});
