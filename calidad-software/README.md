# calidad-software

Coordinador de calidad de software. Recibe una carpeta local o una URL de GitHub, reparte el análisis entre tres roles y cierra con un informe ejecutivo descargable en Markdown y PDF.

## Arquitectura

Un agente coordinador (`bot/agent.ts`) fija el orden y escribe el dictamen. Delega en tres subagentes:

| Rol | Qué juzga |
| --- | --- |
| Analista | Criterios de aceptación y su rastro en el código |
| Dev | Comportamiento, arquitectura, seguridad y duplicación real |
| QA | Pruebas, severidad de uso y verificación en sandbox |

Las herramientas viven en `bot/tools/`. Leen el árbol del repositorio, un archivo concreto, los bloques duplicados y, cuando el proyecto lo soporta, `tsc --noEmit` y `npm test`. El clon de GitHub es temporal y se borra al terminar. La publicación del dictamen en un pull request se reclama una sola vez por `owner/repo#número`.

El panel React (Vite, TypeScript y Bootstrap 5) corre aparte y habla con el agente por el proxy de desarrollo. Las métricas y el historial se guardan en `data/`, fuera de Git.

## Arranque

Hace falta Node.js 22.13 o superior. No uses Bun.

```bash
cd calidad-software
npm install
npm run check
npm test
npm run dev
```

El agente escucha en `http://127.0.0.1:3000`. En otra terminal:

```bash
cd calidad-software/frontend
npm install
npm run dev
```

La interfaz queda en `http://localhost:5173/`.
