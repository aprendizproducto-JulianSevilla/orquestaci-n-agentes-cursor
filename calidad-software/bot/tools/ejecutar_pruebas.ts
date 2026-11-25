import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";

export default defineTool({
  description:
    "Ejecuta la prueba del ejemplo de descuento que ya está en el workspace. Úsalo después de cargar_ejemplo y antes de cerrar el informe de QA.",
  execution: "agent",
  inputSchema: z.object({}),
  script: `#!/usr/bin/env bash
set -euo pipefail
cat >/dev/null
node <<'NODE'
const { spawnSync } = require("node:child_process");
const ruta = "ejemplo/src/descuento.test.mjs";
const run = spawnSync(process.execPath, [ruta], { encoding: "utf8" });
process.stdout.write(JSON.stringify({
  ruta,
  exitCode: run.status,
  stdout: run.stdout,
  stderr: run.stderr,
}));
NODE
`,
});
