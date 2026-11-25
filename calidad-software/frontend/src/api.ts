import {
  planDuplicadosSchema,
  resultadoDuplicadosSchema,
  type PlanDuplicadosContrato,
  type ResultadoDuplicados,
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
