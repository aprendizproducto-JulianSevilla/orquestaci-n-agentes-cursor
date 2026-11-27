import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  analisisDuplicadosSchema,
  historialSchema,
  metricasSchema,
  verificacionSchema,
  type AnalisisDuplicadosContrato,
  type MetricasContrato,
  type VerificacionContrato,
} from "./contratos";
import { raizProyecto } from "./rutas";

function destinoDe(relativo: string): string {
  return join(raizProyecto(), "data", relativo);
}

export async function escribirAtomico(relativo: string, valor: unknown): Promise<void> {
  const destino = destinoDe(relativo);
  await mkdir(dirname(destino), { recursive: true });
  const temporal = `${destino}.${randomUUID()}.tmp`;
  await writeFile(temporal, JSON.stringify(valor), "utf8");
  try {
    await rename(temporal, destino);
  } catch {
    await rm(destino, { force: true });
    await rename(temporal, destino);
  }
}

export async function leerJson(relativo: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(destinoDe(relativo), "utf8")) as unknown;
  } catch {
    return null;
  }
}

export async function guardarAnalisis(analisis: AnalisisDuplicadosContrato): Promise<AnalisisDuplicadosContrato> {
  const valido = analisisDuplicadosSchema.parse(analisis);
  await escribirAtomico("duplicados-codigo.json", valido);
  return valido;
}

export async function leerAnalisis(): Promise<AnalisisDuplicadosContrato> {
  const leido = analisisDuplicadosSchema.safeParse(await leerJson("duplicados-codigo.json"));
  if (leido.success) {
    return leido.data;
  }
  return analisisDuplicadosSchema.parse({
    pendiente: true,
    id: "",
    origen: "",
    actualizadoEn: "",
    porcentaje: 0,
    lineasTotales: 0,
    lineasDuplicadas: 0,
    archivosAnalizados: 0,
    archivosOmitidos: 0,
    archivosAfectados: [],
    bloquesTotales: 0,
    bloques: [],
  });
}

export async function guardarVerificacion(verificacion: VerificacionContrato): Promise<VerificacionContrato> {
  const valida = verificacionSchema.parse(verificacion);
  await escribirAtomico("verificacion.json", valida);
  return valida;
}

export async function leerVerificacion(): Promise<VerificacionContrato> {
  const leida = verificacionSchema.safeParse(await leerJson("verificacion.json"));
  if (leida.success) {
    return leida.data;
  }
  return verificacionSchema.parse({
    pendiente: true,
    origen: "",
    actualizadoEn: "",
    registro: "",
    compilacion: { soportado: false, ejecutado: false, codigo: null, agotado: false, stdout: "", stderr: "", motivo: "" },
    pruebas: {
      existe: false,
      valido: false,
      script: "",
      ejecutado: false,
      codigo: null,
      agotado: false,
      stdout: "",
      stderr: "",
      motivo: "",
    },
  });
}

export async function guardarMetricas(metricas: MetricasContrato): Promise<MetricasContrato> {
  const validas = metricasSchema.parse(metricas);
  await escribirAtomico("metricas.json", validas);
  const previo = historialSchema.safeParse(await leerJson("historial.json"));
  const historial = previo.success ? previo.data : [];
  const ultimo = historial.at(-1);
  const igual =
    ultimo !== undefined &&
    ultimo.runs === validas.runs &&
    ultimo.evaluaciones === validas.evaluaciones &&
    ultimo.duplicadosPorcentaje === validas.duplicadosPorcentaje &&
    ultimo.turnosPromedio === validas.turnosPromedio;
  if (!igual) {
    historial.push({
      actualizadoEn: validas.actualizadoEn,
      runs: validas.runs,
      evaluaciones: validas.evaluaciones,
      duplicadosPorcentaje: validas.duplicadosPorcentaje,
      turnosPromedio: validas.turnosPromedio,
    });
    await escribirAtomico("historial.json", historial.slice(-200));
  }
  return validas;
}

export async function leerMetricasGuardadas(): Promise<MetricasContrato | null> {
  const leidas = metricasSchema.safeParse(await leerJson("metricas.json"));
  return leidas.success ? leidas.data : null;
}

export async function leerHistorial(): Promise<unknown> {
  const leido = historialSchema.safeParse(await leerJson("historial.json"));
  return leido.success ? leido.data : [];
}
