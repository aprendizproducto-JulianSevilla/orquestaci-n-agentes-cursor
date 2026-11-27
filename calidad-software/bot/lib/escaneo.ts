import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { esSecreto } from "./rutas";

const IGNORAR = new Set(["node_modules", ".git", ".agent-serve", "dist", "build", "coverage", ".next", "bin", "obj"]);
const OMITIR_ARCHIVO = new Set(["package-lock.json", "yarn.lock", "pnpm-lock.yaml"]);
const EXTENSIONES = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".java", ".cs", ".go", ".rs", ".php", ".rb", ".vue", ".json", ".md",
]);
const EXTENSIONES_SENAL = new Set([".yml", ".yaml", ".xml", ".tf", ".properties", ".http"]);
const DOCUMENTOS = ["README.md", "README", "package.json", "pyproject.toml", "pom.xml", "go.mod", "Cargo.toml"];
const MAX_TEXTO = 8000;
const CUPO_FUENTE = 500;
const CUPO_PRUEBAS = 300;
const CUPO_SECUNDARIOS = 150;

export type Prioridad = "configuracion" | "fuente" | "pruebas" | "secundario";

export type Inventario = {
  truncado: boolean;
  archivos: { ruta: string; bytes: number; prioridad: Prioridad }[];
  senales: { ruta: string; areas: string[] }[];
  documentos: { ruta: string; contenido: string }[];
  calidad: Record<string, number>;
  resumen: { configuracion: number; fuente: number; pruebas: number; secundarios: number; detalleOmitido: number };
  arbol: { directorios: number; archivos: number; rutas: string[]; omitidos: number };
  orden: "configuracion, fuente, pruebas, secundarios";
};

type Nodo = {
  ruta: string;
  directorio: boolean;
  bytes: number;
  prioridad: number;
  areas: string[];
  relevante: boolean;
};

function areasDe(ruta: string): string[] {
  const texto = ruta.replace(/\\/g, "/").toLowerCase();
  const areas: string[] = [];
  if (/(\.|\/)(test|spec)\.|\/tests?\/|__tests__|\.cy\.[jt]sx?$/.test(texto)) areas.push("unitaria");
  if (texto.includes("smoke")) areas.push("humo");
  if (/(^|[/_-])(k6|jmeter|gatling|locust|stress|load-test|loadtest)([/_.-]|$)/.test(texto)) areas.push("carga");
  if (/github\/workflows|jenkinsfile|gitlab-ci|azure-pipelines|dockerfile|docker-compose/.test(texto)) areas.push("cicd");
  if (/serverless|cloudformation|terraform|\.tf$|(^|[/_-])(aws|cdk)([/_.-]|$)/.test(texto)) areas.push("nube");
  if (texto.includes("sonar")) areas.push("sonar");
  if (texto.includes("postman")) areas.push("postman");
  if (/openapi|swagger|\.http$|graphql/.test(texto)) areas.push("interfaz");
  if (/codeql|dependabot|zap|security\.md|snyk/.test(texto)) areas.push("seguridad");
  return areas;
}

function esPrueba(ruta: string): boolean {
  const texto = ruta.replace(/\\/g, "/").toLowerCase();
  return /(^|\/)(cypress|tests?|__tests__|e2e|spec)(\/|$)/.test(texto) || /\.(test|spec)\./.test(texto) || /\.cy\.[jt]sx?$/.test(texto);
}

function esFuente(ruta: string): boolean {
  const texto = ruta.replace(/\\/g, "/").toLowerCase();
  return /(^|\/)(src|app|lib|pages|components|modules|bot)(\/|$)/.test(texto);
}

function esConfig(ruta: string): boolean {
  const texto = ruta.replace(/\\/g, "/");
  return /(^|\/)(package\.json|tsconfig.*\.json|Dockerfile|docker-compose.*|Jenkinsfile|gitlab-ci\.yml|azure-pipelines.*|vercel\.json|netlify\.toml|pyproject\.toml|go\.mod|pom\.xml|Cargo\.toml|README\.md|README)$/i.test(texto)
    || /(^|\/)\.github\/workflows\/.+\.(yml|yaml)$/i.test(texto);
}

function etiqueta(prioridad: number): Prioridad {
  if (prioridad === 0) return "configuracion";
  if (prioridad === 1) return "fuente";
  if (prioridad === 2) return "pruebas";
  return "secundario";
}

async function caminar(raiz: string): Promise<Nodo[]> {
  const nodos: Nodo[] = [];
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
      if (IGNORAR.has(entrada.name) || OMITIR_ARCHIVO.has(entrada.name) || esSecreto(entrada.name) || entrada.isSymbolicLink()) {
        continue;
      }
      const full = join(dir, entrada.name);
      const ruta = relative(raiz, full);
      if (entrada.isDirectory()) {
        nodos.push({ ruta, directorio: true, bytes: 0, prioridad: 4, areas: [], relevante: false });
        pila.push(full);
        continue;
      }
      if (!entrada.isFile()) continue;
      const extension = extname(entrada.name);
      const config = esConfig(ruta);
      const relevante = config || EXTENSIONES.has(extension) || EXTENSIONES_SENAL.has(extension);
      const areas = areasDe(ruta);
      let prioridad = 3;
      if (config) prioridad = 0;
      else if (esPrueba(ruta) && relevante) prioridad = 2;
      else if (esFuente(ruta) && relevante) prioridad = 1;
      let bytes = 0;
      if (relevante) {
        try {
          bytes = (await stat(full)).size;
        } catch {
          bytes = 0;
        }
      }
      nodos.push({ ruta, directorio: false, bytes, prioridad, areas, relevante });
    }
  }
  return nodos;
}

function ordenar(nodos: Nodo[]): Nodo[] {
  return nodos.slice().sort((a, b) => a.prioridad - b.prioridad || a.ruta.localeCompare(b.ruta));
}

export async function inventariarDirectorio(raiz: string): Promise<Inventario> {
  const nodos = await caminar(raiz);
  const archivosNodo = nodos.filter((nodo) => !nodo.directorio && nodo.relevante);
  const grupos = [0, 1, 2, 3].map((nivel) => ordenar(archivosNodo.filter((nodo) => nodo.prioridad === nivel)));
  const configuracion = grupos[0] ?? [];
  const fuente = grupos[1] ?? [];
  const pruebas = grupos[2] ?? [];
  const secundarios = grupos[3] ?? [];
  const elegidos = [
    ...configuracion,
    ...fuente.slice(0, CUPO_FUENTE),
    ...pruebas.slice(0, CUPO_PRUEBAS),
    ...secundarios.slice(0, CUPO_SECUNDARIOS),
  ];
  const detalleOmitido =
    Math.max(0, fuente.length - CUPO_FUENTE) +
    Math.max(0, pruebas.length - CUPO_PRUEBAS) +
    Math.max(0, secundarios.length - CUPO_SECUNDARIOS);
  const senalesTodas = ordenar(nodos.filter((nodo) => nodo.areas.length > 0));
  const calidad: Record<string, number> = {};
  for (const nodo of senalesTodas) {
    for (const area of nodo.areas) calidad[area] = (calidad[area] ?? 0) + 1;
  }
  const criticos = ordenar(nodos.filter((nodo) => nodo.prioridad <= 2 || nodo.directorio));
  const resto = ordenar(nodos.filter((nodo) => nodo.prioridad > 2 && !nodo.directorio));
  const rutas = criticos.map((nodo) => nodo.ruta);
  let omitidos = 0;
  for (const nodo of resto) {
    if (rutas.length >= 5000) omitidos += 1;
    else rutas.push(nodo.ruta);
  }
  const documentos: { ruta: string; contenido: string }[] = [];
  const candidatos = [
    ...DOCUMENTOS.map((nombre) => nombre),
    ...configuracion.map((nodo) => nodo.ruta),
  ];
  const vistos = new Set<string>();
  for (const ruta of candidatos) {
    if (vistos.has(ruta) || documentos.length >= 15 || esSecreto(ruta)) continue;
    vistos.add(ruta);
    try {
      const contenido = await readFile(join(raiz, ruta), "utf8");
      documentos.push({ ruta, contenido: contenido.slice(0, MAX_TEXTO) });
    } catch {
      continue;
    }
  }
  return {
    truncado: detalleOmitido > 0,
    archivos: elegidos.map((nodo) => ({ ruta: nodo.ruta, bytes: nodo.bytes, prioridad: etiqueta(nodo.prioridad) })),
    senales: senalesTodas.slice(0, 150).map((nodo) => ({ ruta: nodo.ruta, areas: nodo.areas })),
    documentos,
    calidad,
    resumen: {
      configuracion: configuracion.length,
      fuente: fuente.length,
      pruebas: pruebas.length,
      secundarios: secundarios.length,
      detalleOmitido,
    },
    arbol: {
      directorios: nodos.filter((nodo) => nodo.directorio).length,
      archivos: nodos.filter((nodo) => !nodo.directorio).length,
      rutas,
      omitidos,
    },
    orden: "configuracion, fuente, pruebas, secundarios",
  };
}
