import { spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { raizProyecto } from "./rutas";

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

export function redactar(texto: string): string {
  const token = process.env.GITHUB_TOKEN ?? "";
  let salida = texto;
  if (token) {
    salida = salida.split(token).join("[redactado]");
  }
  return salida.replace(/https:\/\/[^@\s/]+@github\.com/gi, "https://github.com");
}

function binarioGit(): string {
  const fijos = [process.env.GIT_EXE, "C:\\Program Files\\Git\\cmd\\git.exe", "C:\\Program Files\\Git\\bin\\git.exe"];
  for (const ruta of fijos) {
    if (ruta && existsSync(ruta)) {
      return ruta;
    }
  }
  return "git";
}

function ejecutar(bin: string, args: string[], env: NodeJS.ProcessEnv): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { env, windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
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

export type ClonFallido = {
  ok: false;
  motivo: "git_no_disponible" | "tiempo_agotado" | "clone_fallo" | "autenticacion_requerida";
  detalle?: string;
};

export async function usarClon<T>(
  origen: string,
  branch: string | undefined,
  trabajo: (destino: string) => Promise<T>,
): Promise<{ ok: true; valor: T } | ClonFallido> {
  let destino = "";
  let hooks = "";
  try {
    const clones = join(raizProyecto(), "sandbox", "clones");
    await mkdir(clones, { recursive: true });
    destino = await mkdtemp(join(clones, "clon-"));
    hooks = await mkdtemp(join(tmpdir(), "calidad-hooks-"));
    const args = ["-c", `core.hooksPath=${hooks}`, "clone", "--depth", "1", "--single-branch", "--no-tags"];
    if (branch) {
      args.push("--branch", branch);
    }
    args.push(`${origen}.git`, destino);
    const env: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "Never" };
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
      if (codigo === "ENOENT") {
        return { ok: false, motivo: "git_no_disponible" };
      }
      if (error instanceof Error && error.message === "tiempo_agotado") {
        return { ok: false, motivo: "tiempo_agotado" };
      }
      return { ok: false, motivo: "clone_fallo", detalle: "No se pudo iniciar git." };
    }
    if (clonado.code !== 0) {
      const detalle = redactar(clonado.stderr).slice(0, 500);
      const autenticacion = /authentication|403|401|not found|repository not found/i.test(detalle);
      return {
        ok: false,
        motivo: autenticacion && !token ? "autenticacion_requerida" : "clone_fallo",
        detalle,
      };
    }
    return { ok: true, valor: await trabajo(destino) };
  } catch (error) {
    const detalle = error instanceof Error ? error.message : "fallo";
    return { ok: false, motivo: "clone_fallo", detalle: redactar(detalle).slice(0, 300) };
  } finally {
    if (destino) {
      rmSync(destino, { recursive: true, force: true });
    }
    if (hooks) {
      rmSync(hooks, { recursive: true, force: true });
    }
  }
}
