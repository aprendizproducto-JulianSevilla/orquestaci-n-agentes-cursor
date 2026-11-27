import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { verificacionSchema, type VerificacionContrato } from "./contratos";
import { redactar } from "./clon-temporal";
import { guardarVerificacion } from "./persistencia";
import { raizProyecto } from "./rutas";

const TOPE = 8000;

type Salida = { codigo: number | null; agotado: boolean; stdout: string; stderr: string };

function recortar(texto: string): string {
  const limpio = redactar(texto);
  return limpio.length > TOPE ? `${limpio.slice(0, TOPE)}\n[salida truncada]` : limpio;
}

function entornoReducido(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const nombre of ["PATH", "Path", "NODE_ENV", "HOME", "USERPROFILE", "TEMP", "TMP"]) {
    const valor = process.env[nombre];
    if (valor !== undefined && valor !== "") {
      env[nombre] = valor;
    }
  }
  env.CI = "true";
  env.FORCE_COLOR = "0";
  env.NPM_CONFIG_FUND = "false";
  env.GIT_TERMINAL_PROMPT = "0";
  return env;
}

export function correr(bin: string, args: string[], cwd: string, timeoutMs: number, shell: boolean): Promise<Salida> {
  return new Promise((resolve) => {
    const child = spawn(bin, args, {
      cwd,
      shell,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: entornoReducido(),
    });
    let stdout = "";
    let stderr = "";
    const tomar = (actual: string, chunk: string) => (actual + chunk).slice(-12_000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout = tomar(stdout, chunk);
    });
    child.stderr.on("data", (chunk: string) => {
      stderr = tomar(stderr, chunk);
    });
    let agotado = false;
    const timer = setTimeout(() => {
      agotado = true;
      child.kill();
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ codigo: 1, agotado, stdout: recortar(stdout), stderr: recortar(`${stderr}\n${error.message}`) });
    });
    child.on("close", (codigo) => {
      clearTimeout(timer);
      resolve({ codigo, agotado, stdout: recortar(stdout), stderr: recortar(stderr) });
    });
  });
}

function scriptDe(valor: unknown): string {
  if (!valor || typeof valor !== "object") return "";
  const scripts = (valor as { scripts?: unknown }).scripts;
  if (!scripts || typeof scripts !== "object") return "";
  const test = (scripts as { test?: unknown }).test;
  return typeof test === "string" ? test.trim() : "";
}

export async function verificarDirectorio(raiz: string, origen: string): Promise<VerificacionContrato> {
  let manifiesto = "";
  try {
    manifiesto = await readFile(join(raiz, "package.json"), "utf8");
  } catch {
    manifiesto = "";
  }
  let script = "";
  if (manifiesto) {
    try {
      script = scriptDe(JSON.parse(manifiesto) as unknown);
    } catch {
      script = "";
    }
  }
  const placeholder = /no test specified/i.test(script);
  const peligroso = /(?:^|[;&|])\s*(?:rm|del|format|shutdown)\b/i.test(script);
  const existe = script.length > 0 && !placeholder;
  const valido = existe && !peligroso;
  const tsconfig = existsSync(join(raiz, "tsconfig.json"));
  const tscJs = join(raiz, "node_modules", "typescript", "lib", "tsc.js");
  let compilacion: VerificacionContrato["compilacion"] = {
    soportado: tsconfig,
    ejecutado: false,
    codigo: null,
    agotado: false,
    stdout: "",
    stderr: "",
    motivo: tsconfig ? "" : "sin_tsconfig",
  };
  if (tsconfig && existsSync(tscJs)) {
    const corrida = await correr(process.execPath, [tscJs, "--noEmit", "--pretty", "false", "--incremental", "false"], raiz, 45_000, false);
    compilacion = {
      soportado: true,
      ejecutado: true,
      codigo: corrida.codigo,
      agotado: corrida.agotado,
      stdout: corrida.stdout,
      stderr: corrida.stderr,
      motivo: corrida.agotado ? "tiempo_agotado" : "",
    };
  } else if (tsconfig) {
    compilacion = { ...compilacion, motivo: "typescript_no_instalado" };
  }
  let pruebas: VerificacionContrato["pruebas"] = {
    existe,
    valido,
    script,
    ejecutado: false,
    codigo: null,
    agotado: false,
    stdout: "",
    stderr: "",
    motivo: existe ? (valido ? "" : "script_no_seguro") : "sin_script",
  };
  if (valido && existsSync(join(raiz, "node_modules"))) {
    const corrida = await correr("npm", ["test", "--if-present", "--silent"], raiz, 60_000, true);
    pruebas = {
      ...pruebas,
      ejecutado: true,
      codigo: corrida.codigo,
      agotado: corrida.agotado,
      stdout: corrida.stdout,
      stderr: corrida.stderr,
      motivo: corrida.agotado ? "tiempo_agotado" : "",
    };
  } else if (valido) {
    pruebas = { ...pruebas, motivo: "dependencias_no_instaladas" };
  }
  const id = `ver_${Date.now().toString(36)}`;
  const registro = join("sandbox", "verificaciones", `${id}.log`).replace(/\\/g, "/");
  const absoluto = join(raizProyecto(), registro);
  await mkdir(dirname(absoluto), { recursive: true });
  await writeFile(
    absoluto,
    [`origen: ${origen}`, `compilacion: ${compilacion.codigo ?? compilacion.motivo}`, compilacion.stdout, compilacion.stderr, `pruebas: ${pruebas.codigo ?? pruebas.motivo}`, pruebas.stdout, pruebas.stderr].join("\n"),
    "utf8",
  );
  return guardarVerificacion(
    verificacionSchema.parse({
      pendiente: false,
      origen,
      actualizadoEn: new Date().toISOString(),
      registro,
      compilacion,
      pruebas,
    }),
  );
}
