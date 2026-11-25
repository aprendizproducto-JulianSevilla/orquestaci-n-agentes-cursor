import type { SesionContrato } from "@contratos";

type Props = {
  abierta: boolean;
  candidata: SesionContrato | null;
  conservada: SesionContrato | null;
  onCerrar: () => void;
};

function Bloque({ titulo, sesion }: { titulo: string; sesion: SesionContrato | null }) {
  return (
    <div className="col-md-6">
      <h3 className="h6">{titulo}</h3>
      <pre className="mono border rounded-3 p-3 mb-0 bg-body-tertiary">
        {sesion ? JSON.stringify(sesion, null, 2) : "Sin sesión pareja."}
      </pre>
    </div>
  );
}

export function DuplicateDiffModal({ abierta, candidata, conservada, onCerrar }: Props) {
  if (!abierta) {
    return null;
  }
  return (
    <div className="modal d-block" role="dialog" style={{ background: "rgba(0,0,0,.45)" }}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h2 className="modal-title h5">Comparación de duplicados</h2>
            <button type="button" className="btn-close" aria-label="Cerrar" onClick={onCerrar} />
          </div>
          <div className="modal-body">
            <div className="row g-3">
              <Bloque titulo="Se borraría" sesion={candidata} />
              <Bloque titulo="Se conserva" sesion={conservada} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
