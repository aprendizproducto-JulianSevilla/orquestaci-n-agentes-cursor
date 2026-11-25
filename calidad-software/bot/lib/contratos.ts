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

export type SesionContrato = z.infer<typeof sesionSchema>;
export type PlanDuplicadosContrato = z.infer<typeof planDuplicadosSchema>;
export type ResultadoDuplicados = z.infer<typeof resultadoDuplicadosSchema>;
export type ResultadoRuns = z.infer<typeof resultadoRunsSchema>;
