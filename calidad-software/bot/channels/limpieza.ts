import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineChannel, GET, POST } from "@grok/agent-sdk/channels";
import * as z from "zod/v4";
import { planDuplicadosSchema, resultadoRunsSchema } from "../lib/contratos";
import { aplicarDuplicados, planDuplicados } from "../lib/eliminar-duplicados";
import { eliminarRuns } from "../lib/eliminar-runs";

const sessionsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../.agent-serve/calidad-software/sessions",
);

export default defineChannel({
  routes: [
    GET("/plan", {
      querySchema: z.object({}),
      async handler() {
        const plan = planDuplicadosSchema.parse(await planDuplicados(sessionsDir));
        return Response.json(plan);
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
    POST("/eliminar-runs", {
      bodySchema: z.object({
        ids: z.array(z.string().regex(/^ses_[a-z0-9]+$/)).max(500),
      }),
      async handler(_request, { body }) {
        const resultado = resultadoRunsSchema.parse(await eliminarRuns(sessionsDir, body.ids));
        return Response.json(resultado);
      },
    }),
  ],
});
