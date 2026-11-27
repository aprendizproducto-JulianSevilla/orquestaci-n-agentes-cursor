import { parseGitHubPrContinuationKey } from "@grok/agent-sdk/channels/github";
import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { escribirAtomico, leerJson } from "../lib/persistencia";

const ARCHIVO = "dictamenes-publicados.json";
const colas = new Map<string, Promise<void>>();

function claveDe(owner: string, repo: string, pull: number): string {
  return `${owner}/${repo}#${pull}`;
}

function marcasDe(valor: unknown): Record<string, string> {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
    return {};
  }
  const marcas: Record<string, string> = {};
  for (const [clave, marca] of Object.entries(valor)) {
    if (typeof marca === "string") {
      marcas[clave] = marca;
    }
  }
  return marcas;
}

async function encolar<T>(clave: string, trabajo: () => Promise<T>): Promise<T> {
  const previa = colas.get(clave) ?? Promise.resolve();
  let soltar: () => void = () => undefined;
  const turno = new Promise<void>((resolve) => {
    soltar = resolve;
  });
  colas.set(
    clave,
    previa.then(() => turno),
  );
  await previa;
  try {
    return await trabajo();
  } finally {
    soltar();
  }
}

async function reclamar(owner: string, repo: string, pull: number): Promise<boolean> {
  const clave = claveDe(owner, repo, pull);
  return encolar(clave, async () => {
    const marcas = marcasDe(await leerJson(ARCHIVO));
    if (Object.prototype.hasOwnProperty.call(marcas, clave)) {
      return false;
    }
    marcas[clave] = new Date().toISOString();
    await escribirAtomico(ARCHIVO, marcas);
    return true;
  });
}

async function liberar(owner: string, repo: string, pull: number): Promise<void> {
  const clave = claveDe(owner, repo, pull);
  await encolar(clave, async () => {
    const marcas = marcasDe(await leerJson(ARCHIVO));
    delete marcas[clave];
    await escribirAtomico(ARCHIVO, marcas);
  });
}

export default defineTool({
  description:
    "Publica el dictamen en el pull request de esta sesión. Llámalo una sola vez, y solo en una sesión de pull request. pass aprueba. pass_with_risks y fail piden cambios.",
  effect: "write",
  dryRunResult: ({ verdict }) => ({ posted: false, reason: "dry_run", verdict }),
  inputSchema: z.object({
    verdict: z.enum(["pass", "pass_with_risks", "fail"]),
    summary: z.string().min(1),
  }),
  async execute({ verdict, summary }, ctx) {
    if (ctx.session.purpose === "eval") {
      return { posted: false, reason: "eval", verdict };
    }
    const ref = parseGitHubPrContinuationKey(ctx.session.continuationKey ?? "");
    if (ref === undefined) {
      return { posted: false, reason: "no_pull_request", verdict };
    }
    const reclamado = await reclamar(ref.owner, ref.repo, ref.number);
    if (!reclamado) {
      return { posted: false, motivo: "ya_publicado" };
    }
    const event = verdict === "pass" ? "APPROVE" : "REQUEST_CHANGES";
    try {
      const octokit = await ctx.host.github.getOctokit(
        ref.host === undefined ? undefined : { host: ref.host },
      );
      await octokit.rest.pulls.createReview({
        owner: ref.owner,
        repo: ref.repo,
        pull_number: ref.number,
        event,
        body: summary,
      });
    } catch (error) {
      await liberar(ref.owner, ref.repo, ref.number);
      throw error;
    }
    return {
      posted: true,
      verdict,
      event,
      pr: `${ref.owner}/${ref.repo}#${ref.number}`,
    };
  },
});
