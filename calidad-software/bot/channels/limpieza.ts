import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineChannel, GET, POST } from "@grok/agent-sdk/channels";
import * as z from "zod/v4";
import { aplicarDuplicados, planDuplicados } from "../lib/eliminar-duplicados";

const sessionsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../.agent-serve/calidad-software/sessions",
);

function pagina(action: string, detalle: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Eliminar duplicados</title>
  <style>
    body { font-family: sans-serif; margin: 2rem; max-width: 40rem; background: #fff; color: #111; }
    button { font: inherit; padding: 0.6rem 1rem; cursor: pointer; background: #111; color: #fff; border: 0; }
    pre { white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>Eliminar duplicados</h1>
  <p>Deja la sesión más reciente de cada grupo y borra las copias anteriores. Un grupo comparte canal, propósito, modo y número de turnos.</p>
  <button id="eliminar" type="button">Eliminar duplicados</button>
  <pre id="resultado">${detalle}</pre>
  <script>
    const action = ${JSON.stringify(action)};
    document.getElementById("eliminar").addEventListener("click", async () => {
      const salida = document.getElementById("resultado");
      salida.textContent = "Borrando…";
      const respuesta = await fetch(action, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      salida.textContent = await respuesta.text();
    });
  </script>
</body>
</html>`;
}

export default defineChannel({
  routes: [
    GET("/", {
      querySchema: z.object({}),
      async handler(request) {
        const url = new URL(request.url);
        const base = url.href.endsWith("/") ? url.href : `${url.href}/`;
        const action = new URL("eliminar", base).pathname;
        const plan = await planDuplicados(sessionsDir);
        const detalle = [
          `Se conservarían ${plan.conservar.length}.`,
          `Se borrarían ${plan.eliminar.length}.`,
          ...plan.eliminar.map((sesion) => `borrar ${sesion.id}`),
        ].join("\n");
        return new Response(pagina(action, detalle), {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      },
    }),
    POST("/eliminar", {
      bodySchema: z.object({}),
      async handler() {
        const resultado = await aplicarDuplicados(sessionsDir);
        return Response.json({
          borrados: resultado.borrados,
          conservados: resultado.conservar.map((sesion) => sesion.id),
        });
      },
    }),
  ],
});
