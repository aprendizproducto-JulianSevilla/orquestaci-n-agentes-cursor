import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";

const ID_SEGURO = /^ses_[a-z0-9]+$/;

export async function eliminarRuns(
  sessionsDir: string,
  ids: string[],
): Promise<{ borrados: string[]; fallidos: string[] }> {
  const raiz = resolve(sessionsDir);
  const borrados: string[] = [];
  const fallidos: string[] = [];
  const vistos = new Set<string>();
  for (const id of ids) {
    if (!ID_SEGURO.test(id) || vistos.has(id)) {
      continue;
    }
    vistos.add(id);
    const destino = resolve(raiz, id);
    if (destino !== join(raiz, id)) {
      continue;
    }
    try {
      await rm(destino, { recursive: true, force: true });
      borrados.push(id);
    } catch {
      fallidos.push(id);
    }
  }
  return { borrados, fallidos };
}
