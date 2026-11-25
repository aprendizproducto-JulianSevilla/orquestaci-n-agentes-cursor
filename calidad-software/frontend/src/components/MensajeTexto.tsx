function bloque(texto: string, clave: string) {
  if (texto.startsWith("```")) {
    const cuerpo = texto.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "");
    return (
      <pre className="mono border rounded-3 p-2 bg-body-tertiary" key={clave}>
        <code>{cuerpo}</code>
      </pre>
    );
  }
  const lineas = texto.split("\n");
  if (lineas.length > 1 && lineas.every((linea) => linea.trim().startsWith("|"))) {
    const filas = lineas.filter((linea) => !/^\|\s*-+/.test(linea));
    return (
      <div className="table-responsive" key={clave}>
        <table className="table table-sm table-bordered mb-2">
          <tbody>
            {filas.map((fila) => (
              <tr key={fila}>
                {fila
                  .split("|")
                  .filter((celda) => celda.trim() !== "")
                  .map((celda) => (
                    <td key={celda}>{celda.trim()}</td>
                  ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <p className="mb-2" key={clave}>
      {texto}
    </p>
  );
}

export function MensajeTexto({ texto }: { texto: string }) {
  const partes = texto.split(/(```[\s\S]*?```)/g);
  return <div>{partes.filter(Boolean).map((parte, indice) => bloque(parte, `${indice}-${parte.slice(0, 12)}`))}</div>;
}
