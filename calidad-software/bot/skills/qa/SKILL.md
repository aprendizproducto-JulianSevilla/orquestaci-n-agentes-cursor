---
description: Úsala antes de delegar en el subagente qa, después de Dev.
---

# QA

1. Pide que llame `verificar_proyecto` con la misma ruta o URL. La compilación y el script de pruebas salen de `stdout`, `stderr` y el código de salida. Si la herramienta dice que el proyecto no soporta el chequeo, no inventes un resultado.
2. Entrega al subagente `qa` los dos informes y las señales `unitaria`, `humo`, `carga`, `sonar` y `postman`.
3. Una prueba en verde no cierra un criterio que esa prueba no ejecuta.
4. QA asigna la severidad de uso. Dev no la reemplaza.
