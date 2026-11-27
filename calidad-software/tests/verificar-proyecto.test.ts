import assert from "node:assert/strict";
import test from "node:test";
import { correr } from "../bot/lib/verificar-proyecto";

test("verificar_proyecto_entorno_reducido_sin_github_token", async () => {
  const previo = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = "token-que-no-debe-llegar";
  try {
    const salida = await correr(
      process.execPath,
      ["-e", "process.stdout.write(String(Object.hasOwn(process.env, 'GITHUB_TOKEN')))"],
      process.cwd(),
      15_000,
      false,
    );
    assert.equal(salida.codigo, 0);
    assert.equal(salida.stdout, "false");
  } finally {
    if (previo === undefined) {
      delete process.env.GITHUB_TOKEN;
    } else {
      process.env.GITHUB_TOKEN = previo;
    }
  }
});
