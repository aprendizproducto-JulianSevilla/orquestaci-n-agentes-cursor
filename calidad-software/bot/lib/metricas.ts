import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { metricasSchema, type InstantaneaContrato, type MetricasContrato } from "./contratos";
import { planDuplicados } from "./eliminar-duplicados";
import { guardarMetricas, leerAnalisis, leerMetricasGuardadas } from "./persistencia";
import { raizProyecto } from "./rutas";

async function contarEvals(dir: string): Promise<number> {
  let total = 0;
  let entradas;
  try {
    entradas = await readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entrada of entradas) {
    if (entrada.isDirectory()) total += await contarEvals(join(dir, entrada.name));
    else if (entrada.name.endsWith(".eval.ts")) total += 1;
  }
  return total;
}

export async function metricasActuales(
  sessionsDir: string,
  instantanea?: InstantaneaContrato,
): Promise<MetricasContrato> {
  const plan = await planDuplicados(sessionsDir);
  const todas = [...plan.eliminar, ...plan.conservar];
  const suma = todas.reduce((total, sesion) => total + sesion.turnCount, 0);
  const analisis = await leerAnalisis();
  const previa = await leerMetricasGuardadas();
  const evaluaciones = instantanea?.evaluaciones ?? previa?.evaluaciones ?? (await contarEvals(join(raizProyecto(), "evals")));
  return guardarMetricas(
    metricasSchema.parse({
      actualizadoEn: new Date().toISOString(),
      runs: todas.length,
      evaluaciones,
      duplicadosPorcentaje: analisis.pendiente ? 0 : analisis.porcentaje,
      bloquesDuplicados: analisis.pendiente ? 0 : analisis.bloquesTotales,
      sesionesDuplicadas: plan.eliminar.length,
      turnosPromedio: todas.length === 0 ? 0 : Math.round((suma / todas.length) * 10) / 10,
      sesiones: todas.slice(0, 500).map((sesion) => ({
        sessionId: sesion.id,
        channelId: sesion.channelId,
        mode: sesion.mode,
        turnCount: sesion.turnCount,
        updatedAt: sesion.updatedAt,
        running: false,
      })),
      logs: instantanea?.logs ?? previa?.logs ?? [],
      evaluacionesLineas: instantanea?.evaluacionesLineas ?? previa?.evaluacionesLineas ?? [],
    }),
  );
}
