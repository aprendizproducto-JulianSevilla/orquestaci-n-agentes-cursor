import assert from "node:assert/strict";
import test from "node:test";
import herramienta from "../bot/tools/publicar_dictamen";

type Entrada = { verdict: "pass" | "pass_with_risks" | "fail"; summary: string };
type Resultado = { posted: boolean; motivo?: string };

test("segunda_publicacion_misma_clave", async () => {
  const ejecutar = herramienta.execute as ((entrada: Entrada, ctx: unknown) => Promise<Resultado>) | undefined;
  assert.ok(ejecutar);
  let createReview = 0;
  const numero = 800_000 + (Date.now() % 100_000);
  const ctx = {
    session: {
      purpose: "live",
      continuationKey: `cont:github-pr:acme/calidad#${numero}`,
    },
    host: {
      github: {
        getOctokit: async () => ({
          rest: {
            pulls: {
              createReview: async () => {
                createReview += 1;
              },
            },
          },
        }),
      },
    },
  };
  const primera = await ejecutar({ verdict: "fail", summary: "Hay un fallo con evidencia." }, ctx);
  const segunda = await ejecutar({ verdict: "fail", summary: "Hay un fallo con evidencia." }, ctx);
  assert.equal(primera.posted, true);
  assert.equal(segunda.posted, false);
  assert.equal(segunda.motivo, "ya_publicado");
  assert.equal(createReview, 1);
});
