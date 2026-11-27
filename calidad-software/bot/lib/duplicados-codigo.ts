import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { analisisDuplicadosSchema, type AnalisisDuplicadosContrato } from "./contratos";
import { guardarAnalisis } from "./persistencia";
import { esSecreto } from "./rutas";

const VENTANA = 6;
const MAX_ARCHIVOS = 250;
const MAX_BYTES = 300_000;
const MAX_BLOQUES = 200;
const CODIGO = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".java", ".cs", ".go", ".php", ".rb", ".vue"]);
const IGNORAR = new Set(["node_modules", ".git", ".agent-serve", "dist", "build", "coverage", ".next", "bin", "obj"]);

type Linea = { numero: number; texto: string };
type Archivo = { ruta: string; lineas: Linea[] };

function normalizar(linea: string): string {
  const texto = linea.trim();
  if (!texto || texto === "{" || texto === "}" || texto === "});" || texto === ");") return "";
  if (/^(\/\/|#|\*|\/\*|\*\/)/.test(texto)) return "";
  if (texto.length > 240) return "";
  return texto.replace(/\s+/g, " ");
}

function hashDe(texto: string): string {
  return createHash("sha256").update(texto).digest("hex");
}

function prioridad(ruta: string): number {
  const texto = ruta.replace(/\\/g, "/").toLowerCase();
  if (/(^|\/)(src|app|lib|pages|components|modules|bot)(\/|$)/.test(texto)) return 0;
  if (/(^|\/)(cypress|tests?|__tests__|e2e|spec)(\/|$)/.test(texto) || /\.(test|spec)\./.test(texto)) return 1;
  return 2;
}

async function archivosDe(raiz: string): Promise<{ rutas: string[]; omitidos: number }> {
  const encontrados: string[] = [];
  const pila = [raiz];
  while (pila.length > 0) {
    const dir = pila.pop();
    if (dir === undefined) break;
    let entradas;
    try {
      entradas = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entrada of entradas) {
      if (IGNORAR.has(entrada.name) || esSecreto(entrada.name) || entrada.isSymbolicLink()) continue;
      const full = join(dir, entrada.name);
      if (entrada.isDirectory()) {
        pila.push(full);
        continue;
      }
      if (!entrada.isFile() || !CODIGO.has(extname(entrada.name))) continue;
      const relativo = relative(raiz, full).replace(/\\/g, "/");
      encontrados.push(relativo);
    }
  }
  encontrados.sort((a, b) => prioridad(a) - prioridad(b) || a.localeCompare(b));
  return { rutas: encontrados.slice(0, MAX_ARCHIVOS), omitidos: Math.max(0, encontrados.length - MAX_ARCHIVOS) };
}

async function leer(raiz: string, ruta: string): Promise<Archivo | null> {
  try {
    const info = await stat(join(raiz, ruta));
    if (info.size === 0 || info.size > MAX_BYTES) return null;
    const cuerpo = await readFile(join(raiz, ruta), "utf8");
    if (cuerpo.includes("\0")) return null;
    const lineas: Linea[] = [];
    const filas = cuerpo.split(/\r?\n/);
    for (let i = 0; i < filas.length; i += 1) {
      const texto = normalizar(filas[i] ?? "");
      if (texto) lineas.push({ numero: i + 1, texto });
    }
    return lineas.length > 0 ? { ruta, lineas } : null;
  } catch {
    return null;
  }
}

export async function analizarCodigo(raiz: string, origen: string): Promise<AnalisisDuplicadosContrato> {
  const lista = await archivosDe(raiz);
  const archivos: Archivo[] = [];
  for (const ruta of lista.rutas) {
    const archivo = await leer(raiz, ruta);
    if (archivo) archivos.push(archivo);
  }
  const grupos = new Map<string, { ruta: string; indice: number }[]>();
  for (const archivo of archivos) {
    for (let indice = 0; indice + VENTANA <= archivo.lineas.length; indice += 1) {
      const texto = archivo.lineas.slice(indice, indice + VENTANA).map((linea) => linea.texto).join("\n");
      const clave = hashDe(texto);
      const grupo = grupos.get(clave) ?? [];
      grupo.push({ ruta: archivo.ruta, indice });
      grupos.set(clave, grupo);
    }
  }
  const marcas = new Map<string, Set<number>>();
  for (const grupo of grupos.values()) {
    if (grupo.length < 2) continue;
    for (const ocurrencia of grupo) {
      const set = marcas.get(ocurrencia.ruta) ?? new Set<number>();
      for (let salto = 0; salto < VENTANA; salto += 1) set.add(ocurrencia.indice + salto);
      marcas.set(ocurrencia.ruta, set);
    }
  }
  type Rango = { ruta: string; inicio: number; fin: number; lineas: number; clave: string };
  const rangos: Rango[] = [];
  let lineasTotales = 0;
  let lineasDuplicadas = 0;
  for (const archivo of archivos) {
    lineasTotales += archivo.lineas.length;
    const marcados = marcas.get(archivo.ruta);
    if (!marcados) continue;
    lineasDuplicadas += marcados.size;
    const indices = [...marcados].sort((a, b) => a - b);
    const bloques: number[][] = [];
    for (const indice of indices) {
      const ultimo = bloques.at(-1);
      if (ultimo && indice === (ultimo.at(-1) ?? -2) + 1) ultimo.push(indice);
      else bloques.push([indice]);
    }
    for (const bloque of bloques) {
      if (bloque.length < VENTANA) continue;
      const primera = archivo.lineas[bloque[0] ?? 0];
      const ultima = archivo.lineas[bloque.at(-1) ?? 0];
      if (!primera || !ultima) continue;
      const texto = bloque.map((indice) => archivo.lineas[indice]?.texto ?? "").join("\n");
      rangos.push({
        ruta: archivo.ruta,
        inicio: primera.numero,
        fin: ultima.numero,
        lineas: bloque.length,
        clave: hashDe(texto),
      });
    }
  }
  const porClave = new Map<string, Rango[]>();
  for (const rango of rangos) {
    const grupo = porClave.get(rango.clave) ?? [];
    grupo.push(rango);
    porClave.set(rango.clave, grupo);
  }
  const bloques = [...porClave.values()]
    .filter((grupo) => grupo.length > 1)
    .map((grupo) => ({
      lineas: grupo[0]?.lineas ?? 0,
      ocurrencias: grupo
        .map((rango) => ({ ruta: rango.ruta, inicio: rango.inicio, fin: rango.fin }))
        .sort((a, b) => a.ruta.localeCompare(b.ruta) || a.inicio - b.inicio),
    }))
    .filter((bloque) => bloque.lineas > 0 && bloque.ocurrencias.length > 1)
    .sort((a, b) => b.lineas - a.lineas || (a.ocurrencias[0]?.ruta ?? "").localeCompare(b.ocurrencias[0]?.ruta ?? ""));
  const afectados = [...new Set(bloques.flatMap((bloque) => bloque.ocurrencias.map((item) => item.ruta)))].sort();
  const porcentaje = lineasTotales === 0 ? 0 : Math.round((lineasDuplicadas / lineasTotales) * 10000) / 100;
  return analisisDuplicadosSchema.parse({
    pendiente: false,
    id: `dup_${Date.now().toString(36)}`,
    origen,
    actualizadoEn: new Date().toISOString(),
    porcentaje,
    lineasTotales,
    lineasDuplicadas,
    archivosAnalizados: archivos.length,
    archivosOmitidos: lista.omitidos,
    archivosAfectados: afectados,
    bloquesTotales: bloques.length,
    bloques: bloques.slice(0, MAX_BLOQUES),
  });
}

export async function analizarYGuardar(raiz: string, origen: string): Promise<AnalisisDuplicadosContrato> {
  return guardarAnalisis(await analizarCodigo(raiz, origen));
}
