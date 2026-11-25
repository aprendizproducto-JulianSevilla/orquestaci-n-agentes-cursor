import { defineEval, includes } from "@grok/agent-sdk/evals";

export default defineEval({
  tags: ["repositorio"],
  description: "Sin una carpeta, el coordinador pide la ruta y no carga el ejemplo.",
  async test(t) {
    await t.send("Analiza este repositorio.");
    t.succeeded();
    t.notCalledTool("cargar_ejemplo");
    t.notCalledTool("inspeccionar_repositorio");
    t.check(t.reply, includes(/ruta/i));
  },
});
