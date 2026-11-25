import type { PlanDuplicadosContrato } from "@contratos";

type Props = {
  plan: PlanDuplicadosContrato | null;
  runs: number | null;
  evaluaciones: number | null;
  turnos: number | null;
};

function promedioTurnos(plan: PlanDuplicadosContrato): string {
  const todas = [...plan.eliminar, ...plan.conservar];
  if (todas.length === 0) {
    return "sin datos";
  }
  const suma = todas.reduce((total, sesion) => total + sesion.turnCount, 0);
  return (suma / todas.length).toFixed(1);
}

export function KpiRow({ plan, runs, evaluaciones, turnos }: Props) {
  const total = plan ? plan.eliminar.length + plan.conservar.length : runs;
  const evaluacionesPlan = plan
    ? [...plan.eliminar, ...plan.conservar].filter((sesion) => sesion.purpose === "eval").length
    : evaluaciones;
  const turnosValor = plan ? promedioTurnos(plan) : turnos === null ? "sin datos" : turnos.toFixed(1);
  const tarjetas = [
    { titulo: "Runs", valor: total === null ? "sin datos" : String(total) },
    { titulo: "Evaluaciones", valor: evaluacionesPlan === null ? "sin datos" : String(evaluacionesPlan) },
    { titulo: "Duplicados", valor: plan ? String(plan.eliminar.length) : runs === null ? "sin datos" : "—" },
    { titulo: "Turnos promedio", valor: turnosValor },
  ];
  return (
    <div className="row g-3">
      {tarjetas.map((tarjeta) => (
        <div className="col-6 col-lg-3" key={tarjeta.titulo}>
          <div className="border rounded-3 p-3 h-100 bg-body">
            <div className="text-secondary small">{tarjeta.titulo}</div>
            <div className="mono fs-5 mt-1">{tarjeta.valor}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
