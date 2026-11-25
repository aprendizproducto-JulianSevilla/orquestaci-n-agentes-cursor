import type { SesionContrato } from "@contratos";

type Fila = SesionContrato & { destino: "borrar" | "conservar" };

type Props = {
  filas: Fila[];
  onAbrir: (sesion: Fila) => void;
};

export function DuplicatesTable({ filas, onAbrir }: Props) {
  if (filas.length === 0) {
    return <p className="text-secondary mb-0 p-3">No hay sesiones para este filtro.</p>;
  }
  return (
    <div className="table-responsive">
      <table className="table table-hover align-middle mb-0">
        <thead>
          <tr>
            <th>Sesión</th>
            <th>Canal</th>
            <th>Propósito</th>
            <th>Turnos</th>
            <th>Actualizada</th>
            <th>Destino</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.id} role="button" onClick={() => onAbrir(fila)}>
              <td className="mono">{fila.id}</td>
              <td>{fila.channelId || "—"}</td>
              <td>{fila.purpose}</td>
              <td className="mono">{fila.turnCount}</td>
              <td className="mono">{fila.updatedAt ? fila.updatedAt.slice(0, 16).replace("T", " ") : "sin fecha"}</td>
              <td>
                <span className={`badge ${fila.destino === "borrar" ? "text-bg-danger" : "text-bg-success"}`}>
                  {fila.destino === "borrar" ? "se borraría" : "se conserva"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type { Fila };
