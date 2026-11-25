import { defineEval, includes } from "@grok/agent-sdk/evals";

export default defineEval({
  tags: ["smoke"],
  description: "El ejemplo de descuento se carga y el dictamen no se publica en GitHub.",
  async test(t) {
    await t.send(
      "Analiza el ejemplo de descuento. Carga el ejemplo, delega en analista, dev y qa, en ese orden, y entrega el dictamen.",
    );
    t.succeeded();
    t.calledTool("cargar_ejemplo");
    t.notCalledTool("publicar_dictamen");
    t.check(t.reply, includes(/descuento/i));
  },
});
