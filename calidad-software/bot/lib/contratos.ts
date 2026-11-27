import * as z from "zod/v4";

export const sesionSchema = z.object({
  id: z.string(),
  clave: z.string(),
  updatedAt: z.string(),
  channelId: z.string(),
  purpose: z.string(),
  mode: z.string(),
  turnCount: z.number(),
});

export const planDuplicadosSchema = z.object({
  eliminar: z.array(sesionSchema),
  conservar: z.array(sesionSchema),
});

export const resultadoDuplicadosSchema = z.object({
  borrados: z.array(z.string()),
  conservados: z.array(z.string()),
});

export const resultadoRunsSchema = z.object({
  borrados: z.array(z.string()),
  fallidos: z.array(z.string()),
});

export const ocurrenciaDuplicadaSchema = z.object({
  ruta: z.string(),
  inicio: z.number().int().positive(),
  fin: z.number().int().positive(),
});

export const bloqueDuplicadoSchema = z.object({
  lineas: z.number().int().positive(),
  ocurrencias: z.array(ocurrenciaDuplicadaSchema).min(2),
});

export const analisisDuplicadosSchema = z.object({
  pendiente: z.boolean(),
  id: z.string(),
  origen: z.string(),
  actualizadoEn: z.string(),
  porcentaje: z.number().nonnegative(),
  lineasTotales: z.number().int().nonnegative(),
  lineasDuplicadas: z.number().int().nonnegative(),
  archivosAnalizados: z.number().int().nonnegative(),
  archivosOmitidos: z.number().int().nonnegative(),
  archivosAfectados: z.array(z.string()),
  bloquesTotales: z.number().int().nonnegative(),
  bloques: z.array(bloqueDuplicadoSchema),
});

export const sesionMetricaSchema = z.object({
  sessionId: z.string(),
  channelId: z.string(),
  mode: z.string(),
  turnCount: z.number(),
  updatedAt: z.string(),
  running: z.boolean(),
});

export const metricasSchema = z.object({
  actualizadoEn: z.string(),
  runs: z.number().int().nonnegative(),
  evaluaciones: z.number().int().nonnegative(),
  duplicadosPorcentaje: z.number().nonnegative(),
  bloquesDuplicados: z.number().int().nonnegative(),
  sesionesDuplicadas: z.number().int().nonnegative(),
  turnosPromedio: z.number().nonnegative(),
  sesiones: z.array(sesionMetricaSchema),
  logs: z.array(z.string()),
  evaluacionesLineas: z.array(z.string()),
});

export const instantaneaSchema = z.object({
  evaluaciones: z.number().int().nonnegative(),
  evaluacionesLineas: z.array(z.string().max(500)).max(400),
  logs: z.array(z.string().max(500)).max(400),
});

export const historialSchema = z.array(
  z.object({
    actualizadoEn: z.string(),
    runs: z.number().int().nonnegative(),
    evaluaciones: z.number().int().nonnegative(),
    duplicadosPorcentaje: z.number().nonnegative(),
    turnosPromedio: z.number().nonnegative(),
  }),
);

const faseSchema = z.object({
  ejecutado: z.boolean(),
  codigo: z.number().int().nullable(),
  agotado: z.boolean(),
  stdout: z.string(),
  stderr: z.string(),
  motivo: z.string(),
});

export const verificacionSchema = z.object({
  pendiente: z.boolean(),
  origen: z.string(),
  actualizadoEn: z.string(),
  registro: z.string(),
  compilacion: faseSchema.extend({ soportado: z.boolean() }),
  pruebas: faseSchema.extend({
    existe: z.boolean(),
    valido: z.boolean(),
    script: z.string(),
  }),
});

export type SesionContrato = z.infer<typeof sesionSchema>;
export type PlanDuplicadosContrato = z.infer<typeof planDuplicadosSchema>;
export type ResultadoDuplicados = z.infer<typeof resultadoDuplicadosSchema>;
export type ResultadoRuns = z.infer<typeof resultadoRunsSchema>;
export type AnalisisDuplicadosContrato = z.infer<typeof analisisDuplicadosSchema>;
export type MetricasContrato = z.infer<typeof metricasSchema>;
export type InstantaneaContrato = z.infer<typeof instantaneaSchema>;
export type VerificacionContrato = z.infer<typeof verificacionSchema>;
