import * as z from "zod/v4";
import { repositorioDe } from "./clon-temporal";

const RAMA = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/;

export const ramaSchema = z
  .string()
  .trim()
  .regex(RAMA)
  .refine((valor) => !valor.includes("..") && !valor.startsWith("-"));

export const urlGithubSchema = z
  .string()
  .trim()
  .min(1)
  .refine((valor) => repositorioDe(valor) !== undefined, {
    message: "Usa https://github.com/usuario/repositorio o la misma URL terminada en .git.",
  });

export function conRepositorio<T extends z.ZodRawShape>(extra: T) {
  return z.object({
    ruta: z.string().trim().min(1).optional().describe("Ruta absoluta del repositorio. No la combines con url."),
    url: urlGithubSchema.optional().describe("https://github.com/usuario/repositorio. No la combines con ruta."),
    branch: ramaSchema.optional().describe("Rama. Si se omite, se usa la predeterminada."),
    ...extra,
  });
}

export function elegirEntrada(valor: { ruta?: string; url?: string }):
  | { ok: true; tipo: "ruta"; ruta: string }
  | { ok: true; tipo: "url"; url: string }
  | { ok: false; motivo: "entrada_invalida" } {
  if (valor.ruta && valor.url) {
    return { ok: false, motivo: "entrada_invalida" };
  }
  if (valor.url) {
    return { ok: true, tipo: "url", url: valor.url };
  }
  if (valor.ruta) {
    return { ok: true, tipo: "ruta", ruta: valor.ruta };
  }
  return { ok: false, motivo: "entrada_invalida" };
}
