# Evidencias de verificación

Fecha: 2026-10-14, America/Guatemala. El alcance local incluye 2D y 3D. La publicación se aplazó explícitamente por el usuario: preparar build y elegir destino después.

## Matriz de requisitos

| Requisito                  | Evidencia actual                                                                                                                                    | Límite                                                                              |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| RF01 dibujo                | freehandPlaybackUsesDrawing, freehandMultipleStrokesClearAndPresetSelection, freehandControlsFitMobileAndEmptyDrawingDoesNotTrapNavigation          | Ratón automatizado; lápiz físico pendiente.                                         |
| RF02 preparación/cierre    | resamplesSquareByDistance, rejectsInvalidCurve, preservesOrientationAndClosureChoice, normalizationIsInvertible                                     | Cierre explícito también en SVG.                                                    |
| RF03 FFT 2D                | positiveAndNegativeCircle, matchesIndependentDft, seededCoefficientsMatchIndependentDftAtSmallSizes, reconstructionAndTruncation                    | Oráculo DFT en N=8,16,32.                                                           |
| RF04 capas                 | desktopMobileKeyboardAndAxe y capturas reales                                                                                                       | Auditoría de lectores de pantalla físicos pendiente.                                |
| RF05 reloj                 | phaseIsIndependentOfFrameRate, limitsInterruptedFrameDelta, freehandPlaybackUsesDrawing                                                             | Reloj 30/60/120 Hz simulado.                                                        |
| RF06 composición           | manualPresetsArePeriodicAndValidated, manualSaveReloadAndJsonExport                                                                                 | Hasta 32 círculos, valores validados.                                               |
| RF07 ejemplos              | presetSelectionSurvivesImportAndClearsAfterGeometryEdit; ejemplos 2D/3D y flujos de selección                                                       | Cada selección usa el mismo núcleo.                                                 |
| RF08 explicación           | /learn, coeficientes y magnitudes del inspector                                                                                                     | Demostración interactiva propia.                                                    |
| RF09 biblioteca            | saveClearsDraftAndReloadKeepsGeometry, manualSaveReloadAndJsonExport, saveCannotOverwriteConcurrentEdit, failedSaveKeepsSourceAndExportableSnapshot | Privacidad/quota reales varían por navegador.                                       |
| RF10 PNG/SVG               | pngSvgAndImportSafety, exportedSvgImportsAndKeepsSourceOrientation, rejectsUnsafeSvgWithoutExecutingMarkup                                          | Subconjunto documentado; transparencia/resolución configurables.                    |
| RF11 enlace                | shareRoundTripUnicodeAndSizeLimits, shareLinkPreviewAndV1RoundTrip                                                                                  | Límite 6000 bytes / 8000 caracteres.                                                |
| RF12 responsive/teclado    | desktopMobileKeyboardAndAxe; capturas 1440×900 y 360×800 en tres motores                                                                            | No equivale a teléfono físico.                                                      |
| RF13 FFT 3D                | reconstructsSpatialSamples, realSpectrumNyquist                                                                                                     | Matemática independiente de GPU.                                                    |
| RF14 equivalencia          | circlePairEqualsEllipse; modo elipses/círculos en renderer                                                                                          | Degeneraciones comparadas en 257 fases.                                             |
| RF15 edición espacial      | spatialEditingAndGlbExport                                                                                                                          | Tabla numérica, planos, manipulador y spline/polilínea.                             |
| RF16 conversión/proyección | vista previa medida de elevación, projectionCreatesCopyAndPreservesSpatialSource                                                                    | Original conservado en sesión y borrador; nuevo ID para copia.                      |
| RF17 composición 3D        | manualPresetsArePeriodicAndValidated; editor de normal/planos                                                                                       | Bases ortonormales validadas.                                                       |
| RF18 tubo/GLB              | tubeMeetsCurveToleranceOrBlocksExport, analyticDerivativeAndBoundPreserveHighFrequency, translatedGlbReimportsInSourceFrame                         | Coordenadas GLB en unidades del proyecto, decisión documentada.                     |
| RF19 captura/video         | videoCycleOrExplicitUnsupportedState                                                                                                                | Chromium/Firefox graban; WebKit ofrece alternativa cuando no soporta captureStream. |
| RF20 compatibilidad        | migratesRealV1WithMissingSpatialFields, projectRoundTripAndMigrationPreserveGeometry, shareLinkPreviewAndV1RoundTrip                                | Fixture V1 real; no existe release V1 alojado histórico para comparar.              |
| RF21 publicación           | build de producción servido por scripts/serve.mjs; workers/chunks/rutas reales                                                                      | HTTPS externo pendiente por decisión del usuario.                                   |
| RF22 documentación         | README, learning, math-conventions, dependencies, performance, release, implementation                                                              | Cierre público de T20 depende del alojamiento.                                      |

## Revisión independiente

Se revisó la implementación desde contexto independiente. Se encontraron y corrigieron: geometría inválida aceptada antes del reemplazo, guardado que podía sobrescribir una edición posterior, error de worker obsoleto que podía detener el actual, escala GLB que alteraba traslación, migración V1 que requería campos V2 y pérdida del documento al alternar dimensión. Las regresiones de datos/worker se observaron fallar antes de corregirlas y pasaron después.

Se corrigieron además dos landmarks detectados por axe, contraste del trazo en reposo y esquema de color de selectores en WebKit. Las capturas se inspeccionaron visualmente. Los exports GLB se reimportaron con GLTFLoader y se verificó la caja de una curva trasladada/no unitaria.

## Verificaciones pendientes que no se sustituyen por código

- Alojamiento HTTPS, cuenta/destino, reglas/cache reales del proveedor y prueba desde otro dispositivo.
- Safari/iOS real, dispositivo Android, lápiz, lector de pantalla y zoom de navegador físico 200 %. WebKit y viewport móvil son pruebas automatizadas de escritorio.
- Medición de rendimiento y batería en móviles físicos; memoria GPU y heap exactos. El test de ciclo de vida verifica recursos propios/counters, no todo el caché del navegador.
- CI alojada y actionlint: se preparó el workflow y se comprobó su YAML/estructura, pero no se ha ejecutado en GitHub ni hay actionlint instalado en esta máquina.
- Un build V1 anterior independiente no existe: la compatibilidad se prueba con archivos V1 y migración, no se atribuye a una versión pública inexistente.

El resultado local no se presenta como publicación ni como cierre de todos los criterios externos T11/T18/T19/T20.

## Resultado final local

- npm ci con Node local 24.15.0: exit 0; 408 paquetes reinstalados desde lockfile.
- npm run lint: exit 0, incluidos los workers.
- npm run format:check: exit 0.
- npm run test:ci: 12 archivos, 42 pruebas aprobadas.
- npm run build: exit 0; salida dist/epicycle-studio/browser.
- npm run test:e2e: 43 aprobadas, 2 omitidas explícitamente. Las omisiones son mediciones de rendimiento en Firefox/WebKit; la referencia usa Chromium. Los flujos funcionales pasan en los tres motores.
- 20 montajes espaciales por motor: geometrías acotadas y un renderer vivo; fuente 2D conservada al volver.
- savedViewAndTransparentPngOptions verifica zoom restaurado y alpha real de captura 2×.
- contextLossUsesProjectionAndRestoresPaused verifica proyección de recuperación y regreso pausado.

Reporte HTML: playwright-report/index.html. Capturas: docs/screenshots. Mediciones reproducibles: docs/performance-measured.json y docs/bundle-measured.json. Los datos corresponden a pruebas de escritorio; no se convierten en validación móvil física.

## Verificación del rediseño — 2026-10-14

- Suite completa npm run test:e2e: 46 aprobadas, 2 omitidas (medición RAF en Firefox/WebKit), exit 0. Incluye grabación, exportaciones, recuperación WebGL y 20 montajes espaciales por motor.
- npm run test:ci: 42 pruebas aprobadas en 12 archivos, exit 0.
- npm run lint: exit 0. Build del rediseño antes del último ajuste de posición de zoom: exit 0 sin advertencias de presupuesto.
- La prueba de estrés conserva los 20 ciclos y las mismas cotas. Su timeout es 90 s: el trace de WebKit completaba las 42 acciones necesarias alrededor del límite anterior de 60 s con el canvas completo.
- fullViewportWorkspaceAndCollapsibleChrome verifica ambas dimensiones, retorno de foco del inspector, tooltips y exportación por teclado, nombres estables con hover, transporte plegable y límites del inspector móvil.
- desktopMobileKeyboardAndAxe verifica herramientas plegables, teclado y axe a 1440×900 / 360×800.

Las validaciones son locales en navegadores de escritorio; la publicación HTTPS sigue aplazada por decisión del usuario.

Validación del último pulido visual: build final exit 0 sin advertencias y 9/9 pruebas de interfaz aprobadas en Chromium, Firefox y WebKit mediante npm run test:e2e -- --grep 'fullViewportWorkspaceAndCollapsibleChrome|desktopMobileKeyboardAndAxe|spatialEditingAndGlbExport' --reporter=list. Se inspeccionaron las capturas finales de escritorio 3D y móvil 2D. La suite completa previa al cambio de posición de zoom aprobó 46/46 casos ejecutados; las dos omisiones siguen siendo mediciones RAF fuera de Chromium.

## Cabecera y raíles alineados, nombre y video — 2026-10-14

- Build final y lint: exit 0. Se mantiene advertencia del CSS del shell: 13.65 kB frente al aviso de 12 kB; límite de error 16 kB. No se ampliaron presupuestos.
- Unitarios: 42/42, 12 archivos, ejecutados tras los cambios.
- Pasada final `npm run test:e2e -- --grep 'touchWorkspace|alignedChrome|inlineName|flatAnimation|visualChoices'`: 13 aprobadas y 2 omitidas, exit 0. La emulación táctil se ejecuta en Chromium; sus dos variantes de Firefox/WebKit se omiten deliberadamente. El resto de casos se ejecuta en los tres motores.
- Resoluciones: 1440×900, 360×800, 320×640 y 844×390. Se comprueban bordes de cabecera, alineación de panel/raíles, separación de reproducción, distribución vertical de cámaras, secciones abiertas por tamaño y estado del inspector en ambos sentidos de navegación. Chromium añade `hasTouch`/`isMobile` y acciones `tap`.
- Nombre: confirmación tras inactividad y al salir/Enter, espacios vacíos → «Sin nombre», límite de 80 caracteres, conservación entre dimensiones y guardado.
- Video 2D: cancelar y volver a grabar; descargar, decodificar y reproducir el video, comparar dos fotogramas y verificar 1280×720, fase y estado pausado conservados. Chromium y Firefox graban; el WebKit local informa explícitamente que no admite MediaRecorder. Buscar dos posiciones del WebM en Firefox no ofrecía una comparación fiable; la comprobación final usa reproducción real.
- La suite general previa registró 59 aprobadas, 2 omitidas y 2 fallos: la comparación por búsqueda en Firefox y una colisión de archivos de traza al ejecutar otro runner simultáneamente. Los dos casos se repitieron correctamente en la pasada final aislada. Ese resultado no se presenta como una nueva ejecución completa de los 66 casos actuales.
- Inspección visual de escritorio, móvil estrecho y nudo inicial 3D. Capturas `*-aligned-*.png` y `*-initial-knot.png` en `docs/screenshots`. Detector Impeccable `[]`; revisión estática independiente, con guardia adicional para impedir grabar durante análisis.

Las pruebas móviles son emuladas; siguen pendientes teléfonos físicos y publicación externa.

Actualización de posición del zoom: el inspector ocupa el borde derecho; abierto, la columna de zoom/cámara queda a su izquierda, y cerrado vuelve al borde derecho. Prueba `alignedChrome` ampliada para comprobar ambos estados y separación en 1440×900, 360×800, 320×640 y 844×390. Pasada final `--grep 'alignedChrome|touchWorkspace'`: 4 aprobadas, 2 variantes táctiles omitidas fuera de Chromium, exit 0. Build, lint y formato correctos; detector Impeccable `[]`. Advertencia CSS actual: 13.86 kB frente al aviso de 12 kB.

## Entrega limpia para Cloudflare Pages — 2026-10-14

- Suite completa actual: **62 aprobadas, 4 omitidas**, exit 0; 66 casos. Se omiten las dos mediciones RAF fuera de Chromium y las dos variantes de emulación táctil fuera de Chromium. Todos los demás casos se ejecutan en Chromium, Firefox y WebKit.
- Unitarios: **42 aprobados**, 12 archivos. Lint y comprobación TypeScript `--noUnusedLocals --noUnusedParameters`: exit 0.
- La regresión del shell exporta el proyecto inicial 3D y comprueba órbitas y vectores activos. Las capturas actuales muestran el nombre ampliado y se conservan únicamente escritorio, móvil y 3D en `docs/screenshots/studio-*.png`; los informes/capturas automáticas se generan en rutas ignoradas.
- Build estático: `dist/epicycle-studio/browser`; el proceso añade los avisos de terceros. ZIP para carga manual: `artifacts/epicycle-studio-cloudflare-pages.zip`, con SHA-256 adyacente. No contiene fuentes, datos de IndexedDB, herramientas locales ni credenciales.
- `plan.md` conserva pendientes; no se atribuyen a esta entrega publicación HTTPS, CI alojada, flags estrictos completos ni dispositivos físicos. Persiste el aviso de tamaño CSS; su reducción permanece pendiente.

## Opciones de captura

`captureBackgroundGridZoomAndIndependentVideoSettings` verifica píxeles PNG (oscuro, cuadrícula y transparencia), fondo SVG, ampliación de la vista previa y separación de opciones imagen/video. `capturePanelFitsMobileAndSpatialPngKeepsDarkBackground` verifica límites del panel móvil, negro/transparencia PNG en 3D y liberación del renderizador auxiliar. `flatAnimationVideoCanCancelAndExportsMovingFramesWithoutChangingPhase` decodifica el video exportado, comprueba movimiento entre fotogramas, formato vertical y fondo negro, además de cancelación y conservación de la fase del editor.

## Precisión y edición de dibujos

`termSliderKeepsAccentControlsStableAndPlaybackRunning` registra opacidad, estado de Guardar y reproducción durante movimientos consecutivos del slider. `complexFreehandGetsAdaptiveDetailAndCanBeEditedAndColored` dibuja una curva de 19 lóbulos, comprueba selección automática superior a 64 términos, deforma sus puntos sin cambiar su cantidad y verifica RGB en el lienzo y JSON. La recomendación también tiene una comprobación matemática de las cotas de error; los proyectos anteriores siguen importándose sin los campos opcionales nuevos.
