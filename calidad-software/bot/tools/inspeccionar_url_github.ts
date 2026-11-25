import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { inventariarDirectorio } from "./inspeccionar_repositorio";

const RAMA = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/;

export function repositorioDe(url: string): { owner: string; repo: string } | undefined {
  let analizada: URL;
  try {
    analizada = new URL(url.trim());
  } catch {
    return undefined;
  }
  const host = analizada.hostname.toLowerCase();
  if (analizada.protocol !== "https:" || (host !== "github.com" && host !== "www.github.com")) {
    return undefined;
  }
  if (analizada.username || analizada.password || analizada.search || analizada.hash) {
    return undefined;
  }
  const partes = analizada.pathname.split("/").filter(Boolean);
  if (partes.length !== 2) {
    return undefined;
  }
  const owner = partes[0] ?? "";
  let repo = partes[1] ?? "";
  if (repo.endsWith(".git")) {
    repo = repo.slice(0, -4);
  }
  if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) {
    return undefined;
  }
  return { owner, repo };
}

function binarioGit(): string {
  const fijos = [
    process.env.GIT_EXE,
    "C:\\Program Files\\Git\\cmd\\git.exe",
    "C:\\Program Files\\Git\\bin\\git.exe",
  ];
  for (const ruta of fijos) {
    if (ruta && existsSync(ruta)) {
      return ruta;
    }
  }
  return "git";
}

function redactar(texto: string): string {
  const token = process.env.GITHUB_TOKEN ?? "";
  let salida = texto;
  if (token) {
    salida = salida.split(token).join("[redactado]");
  }
  salida = salida.replace(/https:\/\/[^@\s/]+@github\.com/gi, "https://github.com");
  return salida.slice(0, 500);
}

function ejecutar(
  bin: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      env,
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr = (stderr + chunk).slice(-2000);
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("tiempo_agotado"));
    }, 120_000);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stderr });
    });
  });
}

async function duplicadosDe(
  raiz: string,
  archivos: { ruta: string; bytes: number }[],
): Promise<{ grupos: number; copias: number; archivos: string[][] }> {
  const porHash = new Map<string, string[]>();
  for (const archivo of archivos) {
    if (archivo.bytes === 0 || archivo.bytes > 200_000) {
      continue;
    }
    const cuerpo = await readFile(join(raiz, archivo.ruta));
    const hash = createHash("sha256").update(cuerpo).digest("hex");
    const grupo = porHash.get(hash) ?? [];
    grupo.push(archivo.ruta);
    porHash.set(hash, grupo);
  }
  const repetidos = [...porHash.values()].filter((grupo) => grupo.length > 1);
  return {
    grupos: repetidos.length,
    copias: repetidos.reduce((total, grupo) => total + grupo.length, 0),
    archivos: repetidos,
  };
}

function cobertura(senales: { areas: string[] }[]): Record<string, number> {
  const conteo: Record<string, number> = {};
  for (const senal of senales) {
    for (const area of senal.areas) {
      conteo[area] = (conteo[area] ?? 0) + 1;
    }
  }
  return conteo;
}

export default defineTool({
  description:
    "Clona en solo lectura una URL https://github.com/usuario/repositorio (con o sin .git), inventaría el código y borra el clon. No hace push, commit, pull request ni comentarios. La rama es opcional.",
  effect: "read",
  inputSchema: z.object({
    url: z
      .string()
      .trim()
      .refine((valor) => repositorioDe(valor) !== undefined, {
        message: "Usa https://github.com/usuario/repositorio o la misma URL terminada en .git.",
      }),
    branch: z
      .string()
      .trim()
      .regex(RAMA)
      .refine((valor) => !valor.includes("..") && !valor.startsWith("-"))
      .optional()
      .describe("Rama a clonar. Si se omite, se usa la rama predeterminada."),
  }),
  async execute({ url, branch }) {
    const repo = repositorioDe(url);
    if (!repo) {
      return { ok: false as const, motivo: "url_invalida" };
    }
    const origen = `https://github.com/${repo.owner}/${repo.repo}`;
    const destino = await mkdtemp(join(tmpdir(), `calidad-github-${randomUUID()}-`));
    const hooks = await mkdtemp(join(tmpdir(), `calidad-hooks-${randomUUID()}-`));
    try {
      const args = [
        "-c",
        `core.hooksPath=${hooks}`,
        "clone",
        "--depth",
        "1",
        "--single-branch",
        "--no-tags",
      ];
      if (branch) {
        args.push("--branch", branch);
      }
      args.push(`${origen}.git`, destino);
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        GCM_INTERACTIVE: "Never",
      };
      const token = process.env.GITHUB_TOKEN;
      if (token) {
        env.GIT_CONFIG_COUNT = "1";
        env.GIT_CONFIG_KEY_0 = "http.https://github.com/.extraheader";
        env.GIT_CONFIG_VALUE_0 = `AUTHORIZATION: bearer ${token}`;
      }
      let clonado: { code: number; stderr: string };
      try {
        clonado = await ejecutar(binarioGit(), args, env);
      } catch (error) {
        const codigo = error instanceof Error && "code" in error ? String(error.code) : "";
        if (codigo === "ENOENT" || (error instanceof Error && error.message === "tiempo_agotado")) {
          return {
            ok: false as const,
            motivo: error instanceof Error && error.message === "tiempo_agotado" ? "tiempo_agotado" : "git_no_disponible",
            origen,
          };
        }
        return { ok: false as const, motivo: "clone_fallo", origen, detalle: "No se pudo iniciar git." };
      }
      if (clonado.code !== 0) {
        const detalle = redactar(clonado.stderr);
        const autenticacion = /authentication|403|401|not found|repository not found/i.test(detalle);
        return {
          ok: false as const,
          motivo: autenticacion && !token ? "autenticacion_requerida" : "clone_fallo",
          origen,
          detalle,
        };
      }
      const inventario = await inventariarDirectorio(destino);
      const duplicados = await duplicadosDe(destino, inventario.archivos);
      return {
        ok: true as const,
        origen,
        rama: branch ?? "predeterminada",
        lectura: "solo_lectura",
        persistencia: "clon_temporal_eliminado",
        truncado: inventario.truncado,
        archivos: inventario.archivos,
        senales: inventario.senales,
        documentos: inventario.documentos,
        duplicados,
        calidad: cobertura(inventario.senales),
      };
    } finally {
      rmSync(destino, { recursive: true, force: true });
      rmSync(hooks, { recursive: true, force: true });
    }
  },
});
