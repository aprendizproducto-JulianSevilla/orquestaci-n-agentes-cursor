---
description: Úsala antes de delegar en el subagente qa, después de Dev. En el ejemplo de descuento, después de ejecutar las pruebas.
---

# QA

1. En el ejemplo de descuento, ejecuta `ejecutar_pruebas` cuando los archivos ya están en el workspace. En un repositorio, no ejecutes sus pruebas: pasa la lista de archivos de test del inventario.
2. Entrega al subagente `qa` los dos informes, las señales `unitaria`, `humo`, `carga`, `sonar` y `postman`, y, si existe, la salida de las pruebas.
3. Una prueba en verde no cierra un criterio que esa prueba no ejecuta.
4. QA asigna la severidad de uso. Dev no la reemplaza.
