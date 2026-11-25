import { defineEval, includes } from "@grok/agent-sdk/evals";

export default defineEval({
  tags: ["repositorio"],
  description: "Sin una carpeta, el coordinador pide la ruta y no inventa un repositorio.",
  async test(t) {
    await t.send("Analiza este repositorio.");
    t.succeeded();
    t.notCalledTool("inspeccionar_repositorio");
    t.check(t.reply, includes(/ruta/i));
  },
});
