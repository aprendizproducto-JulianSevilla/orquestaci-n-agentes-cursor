import { readdir, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

type Sesion = {
  id: string;
  clave: string;
  updatedAt: string;
};

export type PlanDuplicados = {
  eliminar: Sesion[];
  conservar: Sesion[];
};

const ID_SEGURO = /^ses_[a-z0-9]+$/;

async function leerSesiones(sessionsDir: string): Promise<Sesion[]> {
  let nombres: string[];
  try {
    nombres = await readdir(sessionsDir);
  } catch {
    return [];
  }
  const sesiones: Sesion[] = [];
  for (const nombre of nombres) {
    if (!ID_SEGURO.test(nombre)) {
      continue;
    }
    try {
      const raw = await readFile(join(sessionsDir, nombre, "session.json"), "utf8");
      const data = JSON.parse(raw) as {
        channelId?: string;
        purpose?: string;
        mode?: string;
        turnCount?: number;
        updatedAt?: string;
      };
      sesiones.push({
        id: nombre,
        clave: [
          data.channelId ?? "",
          data.purpose ?? "live",
          data.mode ?? "",
          String(data.turnCount ?? 0),
        ].join("|"),
        updatedAt: data.updatedAt ?? "",
      });
    } catch {
      continue;
    }
  }
  return sesiones;
}

export async function planDuplicados(sessionsDir: string): Promise<PlanDuplicados> {
  const sesiones = await leerSesiones(sessionsDir);
  const porClave = new Map<string, Sesion[]>();
  for (const sesion of sesiones) {
    const grupo = porClave.get(sesion.clave) ?? [];
    grupo.push(sesion);
    porClave.set(sesion.clave, grupo);
  }
  const eliminar: Sesion[] = [];
  const conservar: Sesion[] = [];
  for (const grupo of porClave.values()) {
    const orden = [...grupo].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const queda = orden[0];
    if (queda !== undefined) {
      conservar.push(queda);
    }
    eliminar.push(...orden.slice(1));
  }
  return { eliminar, conservar };
}

export async function aplicarDuplicados(
  sessionsDir: string,
): Promise<PlanDuplicados & { borrados: string[] }> {
  const plan = await planDuplicados(sessionsDir);
  const raiz = resolve(sessionsDir);
  const borrados: string[] = [];
  for (const sesion of plan.eliminar) {
    if (!ID_SEGURO.test(sesion.id)) {
      continue;
    }
    const destino = resolve(raiz, sesion.id);
    if (destino !== join(raiz, sesion.id)) {
      continue;
    }
    await rm(destino, { recursive: true, force: true });
    borrados.push(sesion.id);
  }
  return { ...plan, borrados };
}
