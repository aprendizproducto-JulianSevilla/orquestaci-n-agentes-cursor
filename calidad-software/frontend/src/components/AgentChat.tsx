import { useEffect, useState, type FormEvent } from "react";
import {
  continuarSesion,
  crearSesion,
  descargarInforme,
  eventosDe,
  informeCerrado,
  listarSesiones,
  transcripcion,
  turnoActivo,
  type Informe,
  type Mensaje,
  type Rol,
  type SesionChat,
} from "../agentApi";
import { MensajeTexto } from "./MensajeTexto";

export const SESION_GUARDADA = "calidad-software-sesion";

const BADGE: Record<Rol, string> = {
  usuario: "text-bg-secondary",
  Coordinador: "bg-dark-subtle text-body",
  Analista: "bg-primary-subtle text-primary-emphasis",
  Dev: "bg-success-subtle text-success-emphasis",
  QA: "bg-warning-subtle text-warning-emphasis",
};

type Props = {
  onActividad: () => void;
};

function faseDe(mensajes: Mensaje[]): string {
  const ultimo = [...mensajes].reverse().find((mensaje) => mensaje.rol !== "usuario");
  if (!ultimo) {
    return "El coordinador está leyendo el repositorio…";
  }
  if (ultimo.rol === "Analista") {
    return "Analista revisando requisitos…";
  }
  if (ultimo.rol === "Dev") {
    return "Dev revisando código y duplicados…";
  }
  if (ultimo.rol === "QA") {
    return "QA ejecutando verificaciones…";
  }
  return "Coordinador analizando el documento o repositorio…";
}

function Descargas({ informe }: { informe: Informe }) {
  return (
    <div className="btn-group">
      <button type="button" className="btn btn-light btn-sm" onClick={() => descargarInforme(informe, "md")}>
        Descargar reporte
      </button>
      <button type="button" className="btn btn-light btn-sm" onClick={() => descargarInforme(informe, "pdf")}>
        PDF
      </button>
    </div>
  );
}

export function AgentChat({ onActividad }: Props) {
  const [sesion, setSesion] = useState<SesionChat | null>(() => {
    const guardada = sessionStorage.getItem(SESION_GUARDADA);
    if (!guardada) {
      return null;
    }
    try {
      const datos = JSON.parse(guardada) as SesionChat;
      return datos.sessionId && datos.continuationToken ? datos : null;
    } catch {
      return null;
    }
  });
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [revisando, setRevisando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sesion) {
      sessionStorage.removeItem(SESION_GUARDADA);
      return;
    }
    sessionStorage.setItem(SESION_GUARDADA, JSON.stringify(sesion));
  }, [sesion]);

  useEffect(() => {
    if (!sesion) {
      return;
    }
    let activo = true;
    void (async () => {
      let eventos = await pintar(sesion.sessionId).catch(() => []);
      if (activo) {
        setRevisando(turnoActivo(eventos));
      }
      while (activo && turnoActivo(eventos)) {
        await new Promise((resolver) => window.setTimeout(resolver, 1500));
        eventos = await pintar(sesion.sessionId).catch(() => eventos);
        if (activo) {
          setRevisando(turnoActivo(eventos));
        }
      }
      if (activo) {
        setRevisando(false);
      }
    })();
    return () => {
      activo = false;
    };
  }, [sesion?.sessionId]);

  async function pintar(sessionId: string) {
    const eventos = await eventosDe(sessionId);
    const historia = transcripcion(eventos);
    if (historia.length > 0) {
      setMensajes(historia);
    }
    return eventos;
  }

  async function enviar(event: FormEvent) {
    event.preventDefault();
    const message = texto.trim();
    if (!message || enviando) {
      return;
    }
    setTexto("");
    setError("");
    setEnviando(true);
    setMensajes((actual) => [...actual, { id: `local-${Date.now()}`, rol: "usuario", texto: message }]);
    const conocidas = new Set((await listarSesiones().catch(() => [])).map((item) => item.sessionId));
    let sessionId = sesion?.sessionId ?? "";
    let activo = true;
    const reloj = window.setInterval(() => {
      void (async () => {
        if (!activo) {
          return;
        }
        if (!sessionId) {
          const lista = await listarSesiones().catch(() => []);
          const nueva = lista.find((item) => !conocidas.has(item.sessionId));
          if (nueva) {
            sessionId = nueva.sessionId;
          }
        }
        if (sessionId) {
          await pintar(sessionId).catch(() => undefined);
        }
      })();
    }, 1500);
    try {
      const siguiente = sesion ? await continuarSesion(sesion, message) : await crearSesion(message);
      sessionId = siguiente.sessionId;
      setSesion(siguiente);
      let eventos = await pintar(sessionId);
      while (turnoActivo(eventos)) {
        await new Promise((resolver) => window.setTimeout(resolver, 1500));
        eventos = await pintar(sessionId);
      }
      onActividad();
    } catch (fallo: unknown) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo enviar el mensaje.");
    } finally {
      activo = false;
      window.clearInterval(reloj);
      setEnviando(false);
    }
  }

  const informe = { sesionId: sesion?.sessionId ?? null, mensajes };
  const trabajando = enviando || revisando;
  const terminado = !trabajando && informeCerrado(mensajes);

  return (
    <section className="d-flex flex-column flex-grow-1 min-vh-0 h-100 bg-body">
      <div className="border-bottom px-3 py-2 d-flex flex-wrap align-items-center gap-2">
        <span className="mono text-secondary">{sesion?.sessionId ?? "sin sesión"}</span>
      </div>
      {trabajando ? (
        <div className="px-3 pt-3" role="status" aria-live="polite">
          <div className="alert alert-info mb-0">
            <div className="d-flex align-items-center gap-2">
              <span className="spinner-border spinner-border-sm" aria-hidden="true" />
              <span>{faseDe(mensajes)}</span>
            </div>
            <div className="progress mt-2" style={{ height: "0.35rem" }}>
              <div className="progress-bar progress-bar-striped progress-bar-animated w-100" />
            </div>
          </div>
        </div>
      ) : null}
      {terminado ? (
        <div className="px-3 pt-3">
          <div className="alert alert-success d-flex flex-wrap align-items-center gap-2 mb-0">
            <span>✅ Revisión finalizada: Ya terminé de analizar el documento/repositorio</span>
            <Descargas informe={informe} />
          </div>
        </div>
      ) : null}
      <div className="flex-grow-1 overflow-auto p-3 d-grid gap-3 align-content-start">
        {mensajes.length === 0 ? (
          <p className="text-secondary mb-0">
            Escribe una ruta local o una URL de GitHub para que el coordinador, el analista, Dev y QA la revisen.
          </p>
        ) : null}
        {mensajes.map((mensaje) => (
          <article key={mensaje.id} className={mensaje.rol === "usuario" ? "ms-auto" : ""} style={{ maxWidth: "46rem" }}>
            <span className={`badge ${BADGE[mensaje.rol]}`}>{mensaje.rol === "usuario" ? "Tú" : mensaje.rol}</span>
            <div className="mt-1">
              <MensajeTexto texto={mensaje.texto} />
            </div>
          </article>
        ))}
        {error ? <div className="alert alert-warning mb-0">{error}</div> : null}
      </div>
      <form className="border-top p-3 d-flex gap-2" onSubmit={(event) => void enviar(event)}>
        <input
          className="form-control"
          value={texto}
          placeholder="Ruta local, URL de GitHub o una pregunta"
          onChange={(event) => setTexto(event.target.value)}
          disabled={enviando}
        />
        <button className="btn btn-dark" type="submit" disabled={enviando || texto.trim() === ""}>
          Enviar
        </button>
      </form>
    </section>
  );
}
