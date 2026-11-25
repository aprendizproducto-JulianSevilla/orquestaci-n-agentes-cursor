import type { Fila } from "./DuplicatesTable";

type Props = {
  sesion: Fila | null;
  onCerrar: () => void;
  onComparar: (sesion: Fila) => void;
};

export function DetailDrawer({ sesion, onCerrar, onComparar }: Props) {
  return (
    <div className={`offcanvas offcanvas-end ${sesion ? "show" : ""}`} tabIndex={-1} aria-hidden={sesion ? undefined : true}>
      <div className="offcanvas-header">
        <h2 className="offcanvas-title h5">Detalle</h2>
        <button type="button" className="btn-close" aria-label="Cerrar" onClick={onCerrar} />
      </div>
      <div className="offcanvas-body">
        {sesion ? (
          <>
            <p className="mono">{sesion.id}</p>
            <dl className="row small">
              <dt className="col-5">Canal</dt>
              <dd className="col-7">{sesion.channelId || "—"}</dd>
              <dt className="col-5">Propósito</dt>
              <dd className="col-7">{sesion.purpose}</dd>
              <dt className="col-5">Modo</dt>
              <dd className="col-7">{sesion.mode || "—"}</dd>
              <dt className="col-5">Turnos</dt>
              <dd className="col-7 mono">{sesion.turnCount}</dd>
              <dt className="col-5">Clave</dt>
              <dd className="col-7 mono">{sesion.clave}</dd>
            </dl>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => onComparar(sesion)}>
              Comparar con la sesión que se conserva
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
