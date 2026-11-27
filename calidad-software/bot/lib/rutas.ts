import { isAbsolute, relative, resolve, sep } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export function raizProyecto(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../..");
}

export function esSecreto(ruta: string): boolean {
  const base = ruta.replace(/\\/g, "/").split("/").pop() ?? ruta;
  return base === "credentials.json" || base === "id_rsa" || base.startsWith(".env") || base.endsWith(".pem");
}

export function rutaDentro(raiz: string, relativo: string): string | undefined {
  if (!relativo || relativo.includes("\0")) {
    return undefined;
  }
  const base = resolve(raiz);
  const full = resolve(base, relativo);
  const rel = relative(base, full);
  if (rel === "" || rel.startsWith("..") || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    return undefined;
  }
  return full;
}
