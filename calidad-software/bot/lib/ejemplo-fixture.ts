import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const fuente = join(dir, "ejemplo");

export const ejemploArchivos: Record<string, string> = {
  "ejemplo/requisito.md": readFileSync(join(fuente, "requisito.md"), "utf8"),
  "ejemplo/src/descuento.mjs": readFileSync(join(fuente, "descuento.mjs"), "utf8"),
  "ejemplo/src/descuento.test.mjs": readFileSync(
    join(fuente, "descuento.test.mjs"),
    "utf8",
  ),
};
