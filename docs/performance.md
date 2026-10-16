# Rendimiento

## Método

La suite `recordsDesktopFrameBudgetAndLazyLoading` mide intervalos RAF durante 2.5 segundos por escena a 1440×900 y DPR 1, Chromium 156 de Playwright, Windows. Usa el build real servido por HTTP. La escena estándar usa N=512, K=64 / H=32, hasta 48/64 órbitas visibles en 3D, sin texturas ni postprocesado. El detalle completo sigue interviniendo en el lápiz y en la reconstrucción.

`docs/performance-measured.json` conserva una referencia histórica de percentiles y URLs observadas. Cada ejecución actual adjunta `performance-measured.json` al reporte de Playwright y lo escribe dentro de `test-results`, sin modificar documentos versionados. La referencia inicial registró p50 cercano a 16.7 ms y p95 cercano a 16.8 ms, con 37 draw calls en la escena estándar. Es una medición local corta; no demuestra rendimiento sostenido ni batería/GPU de un teléfono.

`scripts/measure.mjs` calcula gzip real de cada chunk y 25 ejecuciones de FFT pura en N=2048. La referencia inicial obtuvo mediana 0.26 ms y p95 1.14 ms. Esa medida excluye preparación, puesta en marcha del worker y transferencia: no equivale a latencia completa de análisis. Consultar JSON medido para resultados de la última ejecución.

## Presupuestos y decisiones

- 2D no descarga Three.js: se verifican los requests antes y después de abrir 3D.
- FFT y muestreo de reconstrucción se ejecutan en worker; una respuesta obsoleta no modifica la escena ni deja promesas pendientes.
- La capa plana estática se cachea. La fase reactiva sólo cambia a 10 Hz; canvas/render usan el reloj directamente.
- Los pares circulares espaciales se preparan al reconstruir, no por frame. Las geometrías y tubos no se regeneran al mover cámara o reproducir.
- El tubo usa 512–2048 segmentos y 8 radiales, sujeto a la cota analítica. El usuario elige una tolerancia mayor antes de aceptar una malla de menor precisión.
- El DPR se limita a 2 escritorio / 1.5 en canvas pequeño. La resolución de captura tiene máximo 4096 por lado.
- La prueba de 20 montajes por navegador comprueba geometrías acotadas y documentos conservados. Hay dispose explícito para geometrías, materiales, controles, RAF y observers.
- El presupuesto SCSS del componente se ajustó de 8 a 16 KiB: contiene el estudio completo, sus controles y responsive. El CSS no descarga fuentes; esta decisión no altera el presupuesto JS.
- Se deshabilitó el caché persistente del CLI durante ejecución por resultados de tests obsoletos al variar dependencias de un test. Los tests finales se ejecutan desde instalación limpia; no se usan reportes anteriores como evidencia final.

Pendientes: hardware móvil, máximos sostenidos N=2048 en tres motores, heap/GPU detallados y tareas largas bajo throttling físico. No se promete 60 fps universal.

La última medición con el lienzo completo a 1440×900 registró 37 draw calls, p50 2D de 16.7 ms y p50 3D de 33.3 ms; p95 aproximado de 33.4 ms en ambos. Consultar performance-measured.json. La ventana gráfica completa incrementa el trabajo de rasterización frente al diseño anterior; estos intervalos locales no se presentan como 60 fps sostenidos. El último pulido posterior sólo mueve la barra de zoom; bundle-measured.json se recalculó desde el build final.

Actualización de la escena inicial — 2026-10-14: el nuevo nudo con tubo, órbitas y vectores inicialmente ocultos registró 5 draw calls y p95 cercano a 16.7 ms en la medición corta local, tanto en 2D como en 3D. Es una escena distinta de la referencia anterior de 37 draw calls; no demuestra el coste de activar todas las órbitas ni rendimiento sostenido en teléfonos. El JSON medido corresponde a esta última ejecución. El CSS del shell genera una advertencia de tamaño (13.65 kB frente a aviso de 12 kB y límite de error de 16 kB); no se aumentaron presupuestos para ocultarla.

Entrega para Pages: órbitas y vectores ahora están activos por defecto. La última medición corta a 1440×900 registra 38 draw calls y p95 cercano a 16.7 ms en ambos modos. Sustituye el estado anterior de la escena inicial en `performance-measured.json`; las mediciones sostenidas y en móviles físicos siguen pendientes. El aviso CSS actual es de 13.86 kB frente a 12 kB.

Revisión 2026-10-16: Chromium usa el canal completo en headless actual. Las advertencias CSS descritas arriba corresponden a entregas históricas; el build de esta revisión cumple los presupuestos sin advertencias. La medición breve adjunta a las pruebas sigue sin sustituir las mediciones sostenidas del plan.
