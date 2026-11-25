import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";

const IGNORAR = new Set([
  "node_modules",
  ".git",
  ".agent-serve",
  "dist",
  "build",
  "coverage",
  ".next",
  "bin",
  "obj",
]);
const OMITIR_ARCHIVO = new Set(["package-lock.json", "yarn.lock", "pnpm-lock.yaml"]);
const EXTENSIONES = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".java",
  ".cs",
  ".go",
  ".rs",
  ".php",
  ".rb",
  ".vue",
  ".json",
  ".md",
]);
const SECRETOS = new Set([
  ".env",
  ".env.local",
  ".env.production",
  "credentials.json",
  "id_rsa",
]);
const DOCUMENTOS = ["README.md", "README", "package.json", "pyproject.toml", "pom.xml", "go.mod"];
const EXTENSIONES_SENAL = new Set([
  ".yml",
  ".yaml",
  ".xml",
  ".tf",
  ".properties",
  ".http",
]);
const MAX_ARCHIVOS = 80;
const MAX_SENALES = 40;
const MAX_TEXTO = 4000;

function areasDe(ruta: string): string[] {
  const texto = ruta.replace(/\\/g, "/").toLowerCase();
  const areas: string[] = [];
  if (/(\.|\/)(test|spec)\.|\/tests?\/|__tests__/.test(texto)) {
    areas.push("unitaria");
  }
  if (texto.includes("smoke")) {
    areas.push("humo");
  }
  if (/(^|[/_-])(k6|jmeter|gatling|locust|stress|load-test|loadtest)([/_.-]|$)/.test(texto)) {
    areas.push("carga");
  }
  if (/github\/workflows|jenkinsfile|gitlab-ci|azure-pipelines|dockerfile|docker-compose/.test(texto)) {
    areas.push("cicd");
  }
  if (/serverless|cloudformation|terraform|\.tf$|(^|[/_-])(aws|cdk)([/_.-]|$)/.test(texto)) {
    areas.push("nube");
  }
  if (texto.includes("sonar")) {
    areas.push("sonar");
  }
  if (texto.includes("postman")) {
    areas.push("postman");
  }
  if (/openapi|swagger|\.http$|graphql/.test(texto)) {
    areas.push("interfaz");
  }
  if (/codeql|dependabot|zap|security\.md|snyk/.test(texto)) {
    areas.push("seguridad");
  }
  return areas;
}

async function listar(raiz: string): Promise<{
  archivos: { ruta: string; bytes: number }[];
  senales: { ruta: string; areas: string[] }[];
  truncado: boolean;
}> {
  const archivos: { ruta: string; bytes: number }[] = [];
  const senales: { ruta: string; areas: string[] }[] = [];
  const pila = [raiz];
  while (pila.length > 0) {
    const dir = pila.pop();
    if (dir === undefined) {
      break;
    }
    const entradas = await readdir(dir, { withFileTypes: true });
    for (const entrada of entradas) {
      if (
        IGNORAR.has(entrada.name) ||
        SECRETOS.has(entrada.name) ||
        OMITIR_ARCHIVO.has(entrada.name)
      ) {
        continue;
      }
      const full = join(dir, entrada.name);
      if (entrada.isSymbolicLink()) {
        continue;
      }
      if (entrada.isDirectory()) {
        pila.push(full);
        continue;
      }
      if (!entrada.isFile()) {
        continue;
      }
      const ruta = relative(raiz, full);
      const areas = areasDe(ruta);
      const extension = extname(entrada.name);
      if (areas.length > 0 && senales.length < MAX_SENALES) {
        senales.push({ ruta, areas });
      }
      if (!EXTENSIONES.has(extension) && !EXTENSIONES_SENAL.has(extension)) {
        continue;
      }
      if (archivos.length >= MAX_ARCHIVOS) {
        return { archivos, senales, truncado: true };
      }
      const info = await stat(full);
      archivos.push({ ruta, bytes: info.size });
    }
  }
  return { archivos, senales, truncado: false };
}

export type Inventario = {
  truncado: boolean;
  archivos: { ruta: string; bytes: number }[];
  senales: { ruta: string; areas: string[] }[];
  documentos: { ruta: string; contenido: string }[];
};

export async function inventariarDirectorio(raiz: string): Promise<Inventario> {
  const { archivos, senales, truncado } = await listar(raiz);
  const documentos: { ruta: string; contenido: string }[] = [];
  for (const nombre of DOCUMENTOS) {
    try {
      const contenido = await readFile(join(raiz, nombre), "utf8");
      documentos.push({
        ruta: nombre,
        contenido: contenido.slice(0, MAX_TEXTO),
      });
    } catch {
      continue;
    }
  }
  return { truncado, archivos, senales, documentos };
}

export default defineTool({
  description:
    "Inventaría un repositorio local. Recibe la ruta absoluta de la raíz. Devuelve hasta 80 archivos, el README o el manifiesto, y señales de pruebas, CI/CD, nube, Sonar, Postman, interfaces y seguridad. No lee secretos ni node_modules.",
  effect: "read",
  inputSchema: z.object({
    ruta: z.string().min(1).describe("Ruta absoluta de la raíz del repositorio."),
  }),
  async execute({ ruta }) {
    const raiz = resolve(ruta);
    let info;
    try {
      info = await stat(raiz);
    } catch {
      return { ok: false as const, motivo: "no_existe", ruta: raiz };
    }
    if (!info.isDirectory()) {
      return { ok: false as const, motivo: "no_es_directorio", ruta: raiz };
    }
    const inventario = await inventariarDirectorio(raiz);
    return { ok: true as const, raiz, ...inventario };
  },
});
