import type { AnalisisDuplicadosContrato } from "@contratos";

type Props = {
  analisis: AnalisisDuplicadosContrato | null;
  filtro: string;
};

export function CodigoDuplicado({ analisis, filtro }: Props) {
  if (!analisis || analisis.pendiente) {
    return (
      <p className="text-secondary mb-0 p-3">
        Todavía no hay un análisis de código. Dev lo genera con analizar_duplicados.
      </p>
    );
  }
  const texto = filtro.trim().toLowerCase();
  const bloques = analisis.bloques.filter((bloque) =>
    bloque.ocurrencias.some((item) => `${item.ruta} ${item.inicio} ${item.fin}`.toLowerCase().includes(texto)),
  );
  const tarjetas = [
    { titulo: "Duplicación", valor: `${analisis.porcentaje.toFixed(2)}%` },
    { titulo: "Líneas", valor: `${analisis.lineasDuplicadas} / ${analisis.lineasTotales}` },
    { titulo: "Bloques", valor: String(analisis.bloquesTotales) },
    { titulo: "Archivos", valor: String(analisis.archivosAfectados.length) },
  ];
  return (
    <div className="p-3 border-bottom">
      <h3 className="h6">Código duplicado</h3>
      <p className="text-secondary small mb-3">
        {analisis.archivosAnalizados} archivos analizados
        {analisis.archivosOmitidos > 0 ? `, ${analisis.archivosOmitidos} quedaron fuera del cupo` : ""}. Origen:{" "}
        <span className="mono">{analisis.origen}</span>
      </p>
      <div className="row g-2 mb-3">
        {tarjetas.map((tarjeta) => (
          <div className="col-6 col-lg-3" key={tarjeta.titulo}>
            <div className="border rounded-3 p-2 h-100 bg-body">
              <div className="text-secondary small">{tarjeta.titulo}</div>
              <div className="mono">{tarjeta.valor}</div>
            </div>
          </div>
        ))}
      </div>
      {bloques.length === 0 ? (
        <p className="text-secondary mb-0">No hay bloques duplicados para este filtro.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Líneas</th>
                <th>Ocurrencias</th>
              </tr>
            </thead>
            <tbody>
              {bloques.map((bloque, indice) => (
                <tr key={`${bloque.lineas}-${indice}`}>
                  <td className="mono">{bloque.lineas}</td>
                  <td className="mono">
                    {bloque.ocurrencias.map((item) => `${item.ruta}:${item.inicio}-${item.fin}`).join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {analisis.bloquesTotales > analisis.bloques.length ? (
        <p className="text-secondary small mt-2 mb-0">
          Se muestran {analisis.bloques.length} de {analisis.bloquesTotales} bloques. El porcentaje cuenta todos.
        </p>
      ) : null}
    </div>
  );
}
