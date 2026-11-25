import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineChannel, GET, POST } from "@grok/agent-sdk/channels";
import * as z from "zod/v4";
import { planDuplicadosSchema } from "../lib/contratos";
import { aplicarDuplicados, planDuplicados } from "../lib/eliminar-duplicados";

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
  ],
});
