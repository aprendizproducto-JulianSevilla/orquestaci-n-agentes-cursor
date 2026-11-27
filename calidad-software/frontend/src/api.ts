import {
  analisisDuplicadosSchema,
  instantaneaSchema,
  metricasSchema,
  planDuplicadosSchema,
  resultadoDuplicadosSchema,
  resultadoRunsSchema,
  type AnalisisDuplicadosContrato,
  type InstantaneaContrato,
  type MetricasContrato,
  type PlanDuplicadosContrato,
  type ResultadoDuplicados,
  type ResultadoRuns,
} from "@contratos";

export async function cargarPlan(): Promise<PlanDuplicadosContrato> {
  const respuesta = await fetch("/agent/v1/channels/limpieza/plan");
  if (!respuesta.ok) {
    throw new Error("El agente no respondió el plan de duplicados.");
  }
  return planDuplicadosSchema.parse(await respuesta.json());
}

export async function eliminarDuplicados(): Promise<ResultadoDuplicados> {
  const respuesta = await fetch("/agent/v1/channels/limpieza/eliminar", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  if (!respuesta.ok) {
    throw new Error("No se pudieron eliminar los duplicados.");
  }
  return resultadoDuplicadosSchema.parse(await respuesta.json());
}

export async function cargarAnalisis(): Promise<AnalisisDuplicadosContrato> {
  const respuesta = await fetch("/agent/v1/channels/limpieza/duplicados-codigo");
  if (!respuesta.ok) {
    throw new Error("No se pudo leer el análisis de duplicados.");
  }
  return analisisDuplicadosSchema.parse(await respuesta.json());
}

export async function cargarMetricas(): Promise<MetricasContrato> {
  const respuesta = await fetch("/agent/v1/channels/limpieza/metricas");
  if (!respuesta.ok) {
    throw new Error("No se pudieron leer las métricas.");
  }
  return metricasSchema.parse(await respuesta.json());
}

export async function guardarInstantanea(datos: InstantaneaContrato): Promise<void> {
  const respuesta = await fetch("/agent/v1/channels/limpieza/instantanea", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(instantaneaSchema.parse(datos)),
  });
  if (!respuesta.ok) {
    throw new Error("No se pudo guardar el historial.");
  }
}

export async function eliminarRuns(ids: string[]): Promise<ResultadoRuns> {
  const respuesta = await fetch("/agent/v1/channels/limpieza/eliminar-runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (respuesta.status === 404) {
    throw new Error("En la terminal de agent-sdk dev, pulsa Enter y vuelve a pulsar Eliminar runs.");
  }
  if (!respuesta.ok) {
    throw new Error("No se pudieron eliminar los runs.");
  }
  return resultadoRunsSchema.parse(await respuesta.json());
}
