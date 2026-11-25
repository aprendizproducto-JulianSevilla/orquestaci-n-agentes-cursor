const ROLES = [
  { nombre: "Analista", detalle: "Requisitos y contratos", clase: "bg-primary-subtle text-primary-emphasis" },
  { nombre: "Dev", detalle: "Código, arquitectura y seguridad", clase: "bg-success-subtle text-success-emphasis" },
  { nombre: "QA", detalle: "Pruebas y severidad de uso", clase: "bg-warning-subtle text-warning-emphasis" },
];

export function Orchestration() {
  return (
    <section className="border rounded-3 bg-body p-3">
      <h2 className="h6 mb-3">Orquestación</h2>
      <div className="flujo">
        <span className="badge rounded-pill bg-dark-subtle text-body">Coordinador</span>
        <i className="bi bi-arrow-right flecha" />
        {ROLES.map((rol) => (
          <span className={`badge rounded-pill ${rol.clase}`} key={rol.nombre} title={rol.detalle}>
            {rol.nombre}
          </span>
        ))}
        <i className="bi bi-arrow-right flecha" />
        <span className="badge rounded-pill bg-secondary-subtle text-secondary-emphasis">GitHub</span>
      </div>
      <p className="text-secondary small mb-0 mt-3">
        El coordinador reparte el inventario. Cada tema lo juzga un solo rol. GitHub despierta el análisis cuando se abre un pull request.
      </p>
    </section>
  );
}
