import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { ejemploArchivos } from "../lib/ejemplo-fixture";

function destinoSeguro(workspaceDir: string, rel: string): string {
  const root = resolve(workspaceDir);
  const full = resolve(root, rel);
  const back = relative(root, full);
  if (back === "" || back.startsWith("..") || back.split(sep).includes("..")) {
    throw new Error(`Ruta fuera del workspace: ${rel}`);
  }
  return full;
}

export default defineTool({
  description:
    "Copia el ejemplo de descuento al workspace y devuelve el requisito, el código y la prueba. Llámalo antes de analizar el ejemplo local.",
  effect: "idempotent",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const archivos: { ruta: string; contenido: string }[] = [];
    for (const [ruta, contenido] of Object.entries(ejemploArchivos)) {
      const full = destinoSeguro(ctx.workspaceDir, ruta);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, contenido, "utf8");
      archivos.push({ ruta, contenido });
    }
    return { archivos };
  },
});
