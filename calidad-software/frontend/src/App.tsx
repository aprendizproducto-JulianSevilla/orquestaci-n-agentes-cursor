import { useEffect, useMemo, useState } from "react";
import type { PlanDuplicadosContrato, SesionContrato } from "@contratos";
import {
  lineasDe,
  listarEvaluaciones,
  listarLogs,
  listarSesiones,
  type SesionRemota,
} from "./agentApi";
import { cargarPlan, eliminarDuplicados, eliminarRuns } from "./api";
import { AgentChat, SESION_GUARDADA } from "./components/AgentChat";
import { DetailDrawer } from "./components/DetailDrawer";
import { DuplicateDiffModal } from "./components/DuplicateDiffModal";
import { DuplicatesTable, type Fila } from "./components/DuplicatesTable";
import { FilterBar } from "./components/FilterBar";
import { KpiRow } from "./components/KpiRow";
import { Orchestration } from "./components/Orchestration";

type Tab = "agent" | "chat" | "runs" | "evaluations" | "logs" | "duplicados";

const TABS: { id: Tab; nombre: string; icono?: string }[] = [
  { id: "agent", nombre: "Agent" },
  { id: "chat", nombre: "Chat", icono: "bi-chat-dots" },
  { id: "runs", nombre: "Runs" },
  { id: "evaluations", nombre: "Evaluations" },
  { id: "logs", nombre: "Logs" },
  { id: "duplicados", nombre: "Duplicados" },
];

function coincide(sesion: SesionContrato, filtro: string): boolean {
  const texto = filtro.trim().toLowerCase();
  if (!texto) {
    return true;
  }
  return [sesion.id, sesion.channelId, sesion.purpose, sesion.mode, sesion.clave]
    .join(" ")
    .toLowerCase()
    .includes(texto);
}

export default function App() {
  const [tema, setTema] = useState<"light" | "dark">("light");
  const [tab, setTab] = useState<Tab>("agent");
  const [filtro, setFiltro] = useState("");
  const [plan, setPlan] = useState<PlanDuplicadosContrato | null>(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [seleccion, setSeleccion] = useState<Fila | null>(null);
  const [comparar, setComparar] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [evaluaciones, setEvaluaciones] = useState<string[]>([]);
  const [sesiones, setSesiones] = useState<SesionRemota[]>([]);
  const [agenteActivo, setAgenteActivo] = useState(false);
  const [chatKey, setChatKey] = useState(0);

  useEffect(() => {
    document.documentElement.dataset.bsTheme = tema;
  }, [tema]);

  function recargar() {
    cargarPlan()
      .then((datos) => {
        setPlan(datos);
        setError("");
      })
      .catch((fallo: unknown) => {
        setPlan(null);
        setError(fallo instanceof Error ? fallo.message : "No hay conexión con el agente.");
      });
    listarSesiones()
      .then((datos) => {
        setSesiones(datos);
        setAgenteActivo(true);
      })
      .catch(() => {
        setSesiones([]);
        setAgenteActivo(false);
      });
    listarLogs()
      .then((datos) => setLogs(lineasDe(datos)))
      .catch(() => setLogs([]));
    listarEvaluaciones()
      .then((datos) => setEvaluaciones(lineasDe(datos)))
      .catch(() => setEvaluaciones([]));
  }

  useEffect(() => {
    recargar();
  }, []);

  const filas = useMemo<Fila[]>(() => {
    if (!plan) {
      return [];
    }
    return [
      ...plan.eliminar.map((sesion) => ({ ...sesion, destino: "borrar" as const })),
      ...plan.conservar.map((sesion) => ({ ...sesion, destino: "conservar" as const })),
    ].filter((sesion) => coincide(sesion, filtro));
  }, [plan, filtro]);

  const lista = tab === "evaluations" ? filas.filter((sesion) => sesion.purpose === "eval") : filas;

  const turnos =
    sesiones.length === 0 ? null : sesiones.reduce((total, sesion) => total + sesion.turnCount, 0) / sesiones.length;

  const runsVisibles = useMemo(
    () =>
      sesiones.filter((sesion) =>
        `${sesion.sessionId} ${sesion.channelId} ${sesion.mode}`.toLowerCase().includes(filtro.trim().toLowerCase()),
      ),
    [sesiones, filtro],
  );

  const pareja = seleccion
    ? (plan?.conservar.find((sesion) => sesion.clave === seleccion.clave) ?? null)
    : null;

  async function borrar() {
    setOcupado(true);
    setAviso("");
    try {
      const resultado = await eliminarDuplicados();
      setAviso(
        resultado.borrados.length === 0
          ? "No había duplicados para borrar."
          : `Se borraron ${resultado.borrados.length} sesiones.`,
      );
      setPlan(await cargarPlan());
      setSeleccion(null);
    } catch (fallo: unknown) {
      setAviso(fallo instanceof Error ? fallo.message : "No se pudieron borrar los duplicados.");
    } finally {
      setOcupado(false);
    }
  }

  async function borrarRuns() {
    const ids = runsVisibles.filter((sesion) => !sesion.running).map((sesion) => sesion.sessionId);
    if (ids.length === 0) {
      return;
    }
    if (!window.confirm(`¿Eliminar ${ids.length} runs? Esas sesiones dejan de aparecer en el historial.`)) {
      return;
    }
    setOcupado(true);
    setAviso("");
    try {
      const resultado = await eliminarRuns(ids);
      const guardada = sessionStorage.getItem(SESION_GUARDADA);
      if (guardada) {
        try {
          const datos = JSON.parse(guardada) as { sessionId?: string };
          if (datos.sessionId && resultado.borrados.includes(datos.sessionId)) {
            sessionStorage.removeItem(SESION_GUARDADA);
            setChatKey((valor) => valor + 1);
          }
        } catch {
          sessionStorage.removeItem(SESION_GUARDADA);
        }
      }
      setAviso(
        resultado.fallidos.length === 0
          ? `Se eliminaron ${resultado.borrados.length} runs.`
          : `Se eliminaron ${resultado.borrados.length} runs. ${resultado.fallidos.length} siguen en uso.`,
      );
      recargar();
    } catch (fallo: unknown) {
      setAviso(fallo instanceof Error ? fallo.message : "No se pudieron eliminar los runs.");
    } finally {
      setOcupado(false);
    }
  }

  function chatNuevo() {
    sessionStorage.removeItem(SESION_GUARDADA);
    setChatKey((valor) => valor + 1);
    setTab("chat");
  }

  return (
    <div className="d-flex flex-column vh-100">
      <header className="topbar px-3 py-2">
        <div className="d-flex align-items-center gap-2">
          <span className="avatar">CS</span>
          <strong>calidad-software</strong>
          <div className="ms-auto d-flex gap-2">
            {tab !== "chat" ? (
              <button type="button" className="btn btn-dark btn-sm" onClick={chatNuevo}>
                New Chat
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => setTema(tema === "light" ? "dark" : "light")}
            >
              {tema === "light" ? "Oscuro" : "Claro"}
            </button>
          </div>
        </div>
        <ul className="nav nav-tabs mt-2">
          {TABS.map((item) => (
            <li className="nav-item" key={item.id}>
              <button
                type="button"
                className={`nav-link ${tab === item.id ? "active" : ""}`}
                onClick={() => setTab(item.id)}
              >
                {item.icono ? <i className={`bi ${item.icono} me-1`} /> : null}
                {item.nombre}
              </button>
            </li>
          ))}
        </ul>
      </header>
      <div className={tab === "chat" ? "d-flex flex-column flex-grow-1 min-vh-0" : "d-none"}>
        <AgentChat key={chatKey} onActividad={recargar} onVolver={() => setTab("agent")} onNuevo={chatNuevo} />
      </div>
      <main className={tab === "chat" ? "d-none" : "container-fluid py-3 d-grid gap-3 overflow-auto flex-grow-1"}>
        <KpiRow plan={plan} runs={agenteActivo ? sesiones.length : null} evaluaciones={agenteActivo ? evaluaciones.length : null} turnos={turnos} />
        {!agenteActivo && error ? (
          <div className="alert alert-warning mb-0">
            {error} Arranca agent-sdk dev en la carpeta calidad-software.
          </div>
        ) : null}
        {agenteActivo && error && tab === "duplicados" ? (
          <div className="alert alert-warning mb-0">
            {error} En la terminal donde ya corre agent-sdk dev, pulsa Enter para cargar esta ruta.
          </div>
        ) : null}
        {tab === "agent" ? <Orchestration /> : null}
        {tab !== "agent" && tab !== "chat" ? (
          <section className="tabla-panel">
            <div className="p-3 border-bottom d-flex flex-wrap gap-2 align-items-center">
              <div className="flex-grow-1" style={{ minWidth: "16rem" }}>
                <FilterBar valor={filtro} onChange={setFiltro} placeholder="Filtrar por sesión, canal o propósito" />
              </div>
              {tab === "runs" ? (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={ocupado || runsVisibles.length === 0 || runsVisibles.every((sesion) => sesion.running)}
                  onClick={() => void borrarRuns()}
                >
                  {ocupado ? "Eliminando…" : "Eliminar runs"}
                </button>
              ) : null}
              {tab === "duplicados" ? (
                <div className="btn-group">
                  <button type="button" className="btn btn-danger btn-sm" disabled={ocupado || !plan || plan.eliminar.length === 0} onClick={() => void borrar()}>
                    {ocupado ? "Borrando…" : "Eliminar duplicados"}
                  </button>
                </div>
              ) : null}
            </div>
            {aviso ? <div className="px-3 pt-3"><div className="alert alert-secondary mb-0">{aviso}</div></div> : null}
            {tab === "logs" ? (
              <ul className="list-group list-group-flush">
                {(logs.length > 0 ? logs : lista.map((sesion) => `${sesion.updatedAt} ${sesion.id}`)).map((linea) => (
                  <li className="list-group-item bg-transparent mono" key={linea}>
                    {linea}
                  </li>
                ))}
              </ul>
            ) : tab === "evaluations" ? (
              <ul className="list-group list-group-flush">
                {(evaluaciones.length > 0 ? evaluaciones : ["Sin evaluaciones. agent-sdk dev tiene que estar activo."]).map((linea) => (
                  <li className="list-group-item bg-transparent mono" key={linea}>
                    {linea}
                  </li>
                ))}
              </ul>
            ) : tab === "runs" && runsVisibles.length > 0 ? (
              <ul className="list-group list-group-flush">
                {runsVisibles.map((sesion) => (
                    <li className="list-group-item bg-transparent" key={sesion.sessionId}>
                      <span className="mono">{sesion.sessionId}</span>
                      <span className="badge text-bg-light border ms-2">{sesion.mode || "chat"}</span>
                      <span className="ms-2">{sesion.turnCount} turnos</span>
                      <span className="mono text-secondary ms-2">{sesion.updatedAt}</span>
                    </li>
                  ))}
              </ul>
            ) : (
              <DuplicatesTable filas={lista} onAbrir={setSeleccion} />
            )}
          </section>
        ) : null}
      </main>
      <DetailDrawer
        sesion={seleccion}
        onCerrar={() => setSeleccion(null)}
        onComparar={() => setComparar(true)}
      />
      <DuplicateDiffModal
        abierta={comparar}
        candidata={seleccion}
        conservada={pareja}
        onCerrar={() => setComparar(false)}
      />
    </div>
  );
}
