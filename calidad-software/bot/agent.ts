import { defineAgent } from "@grok/agent-sdk";

export default defineAgent({
  description:
    "Coordina el análisis de una carpeta local, de un pull request de GitHub o de una URL https://github.com/usuario/repositorio pegada en el chat.",
  model: {
    id: "grok-4.7",
    params: [
      { id: "reasoning_effort", value: "high" },
      { id: "fast", value: "true" },
    ],
  },
});
