import { construirReporte } from "./informeEjecutivo";

export type Rol = "usuario" | "Coordinador" | "Analista" | "Dev" | "QA";

export type Mensaje = {
  id: string;
  rol: Rol;
  texto: string;
};

export type Informe = {
  sesionId: string | null;
  mensajes: Mensaje[];
};

export function descargarInforme(informe: Informe) {
  const reporte = construirReporte(informe);
  const archivo = new Blob([reporte.markdown], { type: "text/markdown;charset=utf-8" });
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(archivo);
  enlace.download = reporte.archivo;
  enlace.click();
  URL.revokeObjectURL(enlace.href);
}

export type SesionChat = {
  sessionId: string;
  continuationToken: string;
};

export type SesionRemota = {
  sessionId: string;
  channelId: string;
  mode: string;
  turnCount: number;
  updatedAt: string;
  running: boolean;
};

export type Evento = {
  index?: number;
  turnId?: string;
  type: string;
  data?: Record<string, unknown>;
};

type SesionHttp = {
  sessionId?: string;
  continuationToken?: string;
  ok?: boolean;
  message?: string;
};

async function json(ruta: string, init?: RequestInit): Promise<unknown> {
  const respuesta = await fetch(ruta, init);
  const cuerpo: unknown = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    const mensaje =
      cuerpo && typeof cuerpo === "object" && "message" in cuerpo
        ? String((cuerpo as { message?: unknown }).message ?? "")
        : "";
    throw new Error(mensaje || `El agente respondió ${respuesta.status}.`);
  }
  return cuerpo;
}

export async function crearSesion(message: string): Promise<SesionChat> {
  const cuerpo = (await json("/agent/v1/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message }),
  })) as SesionHttp;
  if (!cuerpo.sessionId || !cuerpo.continuationToken) {
    throw new Error("El agente no abrió una sesión.");
  }
  return { sessionId: cuerpo.sessionId, continuationToken: cuerpo.continuationToken };
}

export async function continuarSesion(sesion: SesionChat, message: string): Promise<SesionChat> {
  const cuerpo = (await json(`/agent/v1/session/${sesion.sessionId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ continuationToken: sesion.continuationToken, message }),
  })) as SesionHttp;
  if (!cuerpo.continuationToken) {
    throw new Error("El agente no aceptó el mensaje.");
  }
  return { sessionId: sesion.sessionId, continuationToken: cuerpo.continuationToken };
}

export async function eventosDe(sessionId: string): Promise<Evento[]> {
  const respuesta = await fetch(`/agent/v1/session/${sessionId}/events?format=json`);
  if (!respuesta.ok) {
    throw new Error("No se pudo leer la conversación.");
  }
  const cuerpo = (await respuesta.json()) as { events?: Evento[] };
  return cuerpo.events ?? [];
}

export function sesionesDe(valor: unknown): SesionRemota[] {
  const lista =
    valor && typeof valor === "object" && "sessions" in valor
      ? (valor as { sessions?: unknown }).sessions
      : valor;
  if (!Array.isArray(lista)) {
    return [];
  }
  return lista.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const rec = item as Record<string, unknown>;
    const sessionId = typeof rec.sessionId === "string" ? rec.sessionId : "";
    if (!sessionId) {
      return [];
    }
    return [
      {
        sessionId,
        channelId: typeof rec.channelId === "string" ? rec.channelId : "",
        mode: typeof rec.mode === "string" ? rec.mode : "",
        turnCount: typeof rec.turnCount === "number" ? rec.turnCount : 0,
        updatedAt: typeof rec.updatedAt === "string" ? rec.updatedAt : "",
        running: rec.running === true,
      },
    ];
  });
}

export async function listarSesiones(): Promise<SesionRemota[]> {
  const respuesta = await fetch("/agent/v1/sessions");
  if (!respuesta.ok) {
    throw new Error("No se pudieron listar las sesiones.");
  }
  return sesionesDe(await respuesta.json());
}

export async function listarLogs(): Promise<unknown> {
  const respuesta = await fetch("/agent/v1/logs?after=0");
  if (!respuesta.ok) {
    throw new Error("No se pudieron leer los logs.");
  }
  return respuesta.json();
}

export async function listarEvaluaciones(): Promise<unknown> {
  const respuesta = await fetch("/agent/v1/dev/evals");
  if (!respuesta.ok) {
    throw new Error("No se pudieron leer las evaluaciones.");
  }
  return respuesta.json();
}

function rolDe(nombre: string): Rol {
  const limpio = nombre.toLowerCase();
  if (limpio.includes("analista")) {
    return "Analista";
  }
  if (limpio === "dev") {
    return "Dev";
  }
  if (limpio === "qa") {
    return "QA";
  }
  return "Coordinador";
}

function textoDe(data: Record<string, unknown> | undefined): string {
  return typeof data?.text === "string" ? data.text : "";
}

export function lineasDe(valor: unknown): string[] {
  if (Array.isArray(valor)) {
    return valor.flatMap((item) => lineasDe(item));
  }
  if (valor && typeof valor === "object") {
    const rec = valor as Record<string, unknown>;
    for (const clave of ["sessions", "logs", "lines", "entries", "evals", "cases", "runs", "items"]) {
      if (clave in rec) {
        return lineasDe(rec[clave]);
      }
    }
    const id = rec.id ?? rec.sessionId ?? rec.name ?? rec.message ?? rec.line;
    if (typeof id === "string") {
      const extra = typeof rec.updatedAt === "string" ? ` ${rec.updatedAt}` : "";
      return [`${id}${extra}`];
    }
  }
  if (typeof valor === "string" && valor.trim()) {
    return [valor];
  }
  return [];
}

export function turnoActivo(eventos: Evento[]): boolean {
  let activo = false;
  for (const evento of eventos) {
    if (evento.type === "turn.started") {
      activo = true;
    }
    if (evento.type === "turn.completed" || evento.type === "turn.failed" || evento.type === "session.waiting") {
      activo = false;
    }
  }
  return activo;
}

export function transcripcion(eventos: Evento[]): Mensaje[] {
  const roles = new Map<string, Rol>();
  const salida: Mensaje[] = [];
  const estado: { borrador: Mensaje | null } = { borrador: null };

  function guardarBorrador() {
    const pendiente = estado.borrador;
    estado.borrador = null;
    if (pendiente && pendiente.texto.trim()) {
      salida.push(pendiente);
    }
  }

  for (const evento of eventos) {
    const data = evento.data;
    if (evento.type === "subagent.called" && typeof data?.callId === "string") {
      roles.set(data.callId, rolDe(String(data.name ?? "")));
    }
    if (evento.type === "message.received") {
      guardarBorrador();
      const texto = textoDe(data);
      if (texto) {
        salida.push({ id: `u-${evento.index ?? salida.length}`, rol: "usuario", texto });
      }
    }
    const padre = typeof data?.parentCallId === "string" ? data.parentCallId : "";
    const rol: Rol = padre ? (roles.get(padre) ?? "Coordinador") : "Coordinador";
    if (evento.type === "message.appended") {
      const texto = textoDe(data);
      if (!texto) {
        continue;
      }
      const id = `vivo-${padre || evento.turnId || "coord"}`;
      const actual = estado.borrador;
      const mensajeNuevo = actual === null || !actual.id.startsWith(id) || texto.length < actual.texto.length;
      if (mensajeNuevo) {
        guardarBorrador();
        estado.borrador = { id: `${id}-${evento.index ?? salida.length}`, rol, texto };
      } else if (actual) {
        actual.texto = texto;
        actual.rol = rol;
      }
    }
    if (evento.type === "message.completed") {
      const texto = textoDe(data);
      const actual = estado.borrador;
      if (actual && texto.startsWith(actual.texto.slice(0, 24))) {
        estado.borrador = null;
      } else {
        guardarBorrador();
      }
      if (texto.trim()) {
        salida.push({ id: `m-${evento.index ?? salida.length}`, rol, texto });
      }
    }
    if (evento.type === "turn.failed") {
      guardarBorrador();
      const detalle = typeof data?.message === "string" ? data.message : "El turno falló.";
      salida.push({ id: `f-${evento.index ?? salida.length}`, rol: "Coordinador", texto: detalle });
    }
  }
  guardarBorrador();
  return salida;
}
