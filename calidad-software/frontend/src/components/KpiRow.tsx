type Props = {
  runs: number | null;
  evaluaciones: number | null;
  duplicados: number | null;
  turnos: number | null;
};

export function KpiRow({ runs, evaluaciones, duplicados, turnos }: Props) {
  const tarjetas = [
    { titulo: "Runs", valor: runs === null ? "sin datos" : String(runs) },
    { titulo: "Evaluaciones", valor: evaluaciones === null ? "sin datos" : String(evaluaciones) },
    { titulo: "Duplicados", valor: duplicados === null ? "sin análisis" : `${duplicados.toFixed(1)}%` },
    { titulo: "Turnos promedio", valor: turnos === null ? "sin datos" : turnos.toFixed(1) },
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
