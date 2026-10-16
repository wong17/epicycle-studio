# Implementación de plan.md

Inicio: 2026-10-14. Carpeta inicial: sólo plan.md; sin repositorio Git.
Autoridad: especificación integrada en plan.md. Ejecución autorizada por el usuario.

Nota de mantenimiento: el plan original de construcción se redujo a pendientes tras la implementación. Este documento conserva el historial de decisiones; las capturas de iteraciones anteriores se sustituyeron por las tres vistas vigentes enlazadas desde README.

Limpieza de entrega — 2026-10-14: retirados scaffold duplicado, respaldos HTML, scripts de inspección temporales, planes de pruebas completados, informes regenerables, capturas históricas y favicon ICO sin referencias. Conservados código, tests, lockfile, herramientas necesarias y documentación útil. `.gitignore` cubre scratch, artefactos, cachés, logs y configuración local. Las capturas E2E se generan en `test-results/`, y el benchmark usa un directorio temporal que elimina al terminar. Se retiraron dos campos privados sin lecturas del renderer. 3D inicia con órbitas/vectores activos y el nombre usa 14 px en escritorio / 13 px en móvil. El build copia los avisos de terceros al sitio público; el ZIP de Pages no incluye fuentes ni herramientas locales.

## Decisiones

- Trabajo en la carpeta solicitada: no existe checkout ni cambios de código previos que aislar.
- Node global 24.11.1 no cumple Angular 22.2.2 (^24.15.0). Instalar runtime local .tools sin alterar configuración global.
- El diseño y alcance del plan ya están autorizados; brainstorming se usa para revisar decisiones visuales, sin volver a solicitar aprobación del mismo alcance.
- Publicación alojada depende de una cuenta y destino concretos. Preparar y verificar localmente; conservar T11/T19 pendientes hasta verificación HTTPS.
- El ledger es permanente en docs/implementation.md. No introducir commits ni eliminar evidencias para satisfacer scripts de skills que presuponen Git.

## Preflight

Preparación → FFT → restauración: coordenadas normalizadas internas y coeficientes fuente externos, restaurar una vez.
FFT → renderer: DC separado de K; H espacial cuenta armónicos completos.
Proyectos → editor: importar validando antes de reemplazar; guardar fuente, no geometría GPU.
Render → exportación: instantánea de selección completa; fase no recorta exportaciones.
Reloj → UI: render fuera de signals por frame; UI máximo 10 Hz.

## Progreso

- T01–T10: implementación local y verificaciones matemáticas/browser; instalación limpia npm ci completada.
- T11: build estático/CI preparados; alojamiento aplazado por el usuario.
- T12–T17: estudio espacial, edición, equivalencia, GLB, ciclo de vida y compatibilidad implementados y comprobados localmente.
- T18: medición de escritorio y accesibilidad automatizada; validación física pendiente.
- T19: pendiente de destino y verificación HTTPS, según respuesta explícita del usuario.
- T20: documentación local disponible; cierre operativo público depende de T19.

## Skills aplicadas

using-superpowers, executing-plans, brainstorming, frontend-design, dannaway-practical-ui, motion-design, test-driven-development, code-testing, verification-before-completion.

## Dirección visual

Tarea: crear y comprender curvas con una máquina de movimientos circulares.
Paleta: tinta #101819, superficie #172223, líneas #344344, marfil #f1f3e8, ácido #d4f477, coral #ffa68b.
Tipografía: Georgia en títulos editoriales; sistema sans en controles; Consolas para magnitudes.
Firma: gran trayectoria ácida sobre un papel milimetrado oscuro, con órbitas finas y etiquetas de fase.
Layout: barra editorial y herramientas compactas; canvas protagonista e inspector derecho; transporte inferior siempre visible. Móvil: canvas, transporte y controles apilados.
Acciones primarias: reproducir en reposo o finalizar y animar el dibujo actual. Errores explican una recuperación sin perder el documento válido.
Motion funcional de 160 ms, sin decoraciones que compitan con la matemática; iniciar siempre pausado.

## Resoluciones durante implementación

- Ruling: dominio Fourier consolidado en math.ts y backend.ts, y UI del estudio agrupada por capacidad en shell/store/adaptadores; evita decenas de archivos sin lógica independiente. Las responsabilidades numéricas/render/almacenamiento siguen separadas. Costo: al crecer habrá que extraer controles del shell.
- Ruling: construir esquema V2 con lectura/exportación V1 en una sola implementación; no fingir una release V1 anterior. Costo: compatibilidad verificada por fixtures y archivos, pendiente comparación con un build histórico si existiera.
- Ruling: GLB conserva unidades/coordenadas del proyecto; la escala 2/D de una curva trasladada cambiaba su caja. Regresión translatedGlbReimportsInSourceFrame verifica caja real mediante GLTFLoader. Costo: consumidores deben leer extras.units=project en lugar de asumir longitud normalizada 2.
- Ruling: límite visible 64 órbitas 3D escritorio / 48 canvas pequeño, manteniendo todas en el extremo; ayuda a conservar menos de 100 draw calls. La UI indica cantidad representada. Costo: menos órbitas visibles que el máximo inicial 128 propuesto.
- Ruling: presupuesto SCSS del estudio ampliado a 16 KiB, documentado; no ocultar la advertencia ni cambiar presupuesto JS. Costo: estilos del estudio de aproximadamente 11 KiB.
- Ruling: publicación aplazada por respuesta directa del usuario: preparar build; elegirá destino después. Costo: aún no existe verificación de HTTPS/cache/proveedor.

## Revisión y regresiones

Revisión independiente única, con requesting-code-review. Hallazgos Important corregidos: importación degenerada; guardado concurrente; error obsoleto de worker; escala/traslación GLB; fixture V1 real; regreso entre dimensiones; conservación de vista. Regresiones de datos observadas RED→GREEN: rejectsDegenerateImportBeforeReplacement, saveCannotOverwriteConcurrentEdit, dimensionRoundTripRetainsDocument, migratesRealV1WithMissingSpatialFields, staleErrorCannotTerminateCurrentWorker.

PNG/SVG/GLB se descargaron en navegador real. GLB trasladado se reimportó con GLTFLoader. Video se probó en Chromium y Firefox; WebKit declara falta de capacidad de forma visible. Context loss usa una proyección temporal sin reemplazar fuente y vuelve pausado tras restauración.

Los resultados y límites finales se registran en docs/verification.md. No se han realizado cambios globales de Node, commits, pushes ni publicación.

## Skills adicionales aplicadas

threejs-web, threejs-geometry, threejs-interaction, threejs-accessibility, threejs-performance, threejs-testing, threejs-deployment: representación espacial, edición, fallback, presupuestos, disposal y verificación real.
playwright: navegación y capturas; suite permanente autorizada por las tareas del plan.
systematic-debugging: fallos de compilación, errores de concurrencia y diagnóstico de flujos de archivos/contexto.
requesting-code-review: una revisión desde contexto independiente y regresiones dirigidas.
authoring-github-workflows: estructura y parseo/formato del workflow; actionlint alojado no disponible.
documentation-writer: guía, referencia, explicación y evidencia de T20 con el alcance/estructura ya autorizados en plan.md.

Regresión final: savedViewAndTransparentPngOptions reprodujo un ajuste de vista que restablecía zoom tras abrir; se corrigió el estado fitted antes del siguiente RAF. cameraAndPlaybackDoNotReplaceGeometryUndo reprodujo entradas no geométricas en historial; se excluyeron y se conservan vista/apariencia/transporte al deshacer.

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

## Rediseño del espacio de trabajo — 2026-10-14

Solicitud: tema oscuro permanente con acento #d4f477, lienzo completo 2D/3D y controles superpuestos como una herramienta gráfica.

- Barra superior flotante: identidad y estado del proyecto, dimensión, ayuda, biblioteca, guardar, importar, exportar y mostrar inspector.
- Herramientas izquierdas, inspector derecho y reproducción inferior plegables. Las secciones del inspector se contraen con details/summary nativos.
- En móvil el inspector empieza cerrado; al abrir ocupa como máximo 42 % de la altura. El lienzo conserva el tamaño completo, sin desplazamiento de página.
- Iconos SVG locales reutilizables, sin dependencias ni recursos nuevos. Tooltips por hover/foco y nombres aria-label explícitos evitan que el texto generado del tooltip duplique el nombre accesible.
- Escape cierra exportación y devuelve el foco; cerrar el inspector devuelve el foco a su botón. Los controles de dibujo usan iconos con etiquetas accesibles y tooltips.
- El rendering permanece oscuro incluso al abrir JSON antiguos con appearance.theme=light; la compatibilidad y los datos del archivo siguen aceptándose.
- Tokens: fondo #101819, superficie #172122, bordes #344344, texto #eef1e6, secundario #a0b0a9, acento #d4f477. Tipografía del sistema para controles y Georgia sólo en identidad. Motion de controles 160 ms, desactivado con prefers-reduced-motion.
- Skills aplicadas: brainstorming, frontend-design, dannaway-practical-ui, code-testing (regresión enfocada en el shell), systematic-debugging, verification-before-completion y requesting-code-review. Revisión estática independiente sin hallazgos importantes; no sustituye pruebas de navegador.

Evidencia específica: fullViewportWorkspaceAndCollapsibleChrome comprueba lienzo completo, tema, plegado, foco y exportación por teclado en 2D/3D y tamaño del inspector móvil. desktopMobileKeyboardAndAxe verifica barra de herramientas plegable, ausencia de desbordamiento horizontal y axe. videoCycleOrExplicitUnsupportedState comprueba estabilidad del botón de grabación tras completar el ciclo, con su tooltip visible.

Capturas finales inspeccionadas: docs/screenshots/redesign-3d.png (1440×900) y docs/screenshots/redesign-mobile.png (360×800). La barra de zoom superior tiene superficie propia y evita el transporte inferior. El build final compila sin advertencias de presupuesto.

## Pulido con Impeccable — grises neutros

Se retiró el subrayado de hover de la marca. La interfaz, la cuadrícula y las líneas auxiliares 2D/3D, y la guía usan fondos y textos neutros: #151515, #222222, #292929, #3b3b3b, #ededed y #adadad. El acento #d4f477 se conserva; la reconstrucción utiliza el color seleccionado del proyecto. Se eliminaron desenfoques decorativos, sombras redundantes y números del inspector sin significado secuencial.

Skill aplicada: impeccable, context una vez sobre studio-shell.html, polish, operate y craft-floor. Refinamiento del sistema existente autorizado por SCOPED_EXISTING_ALLOWED; sin crear ni cambiar contexto de producto. Detector manual sobre los seis archivos editados: [] (exit 0). Build y lint: exit 0. Pruebas UI existentes en Chromium/Firefox/WebKit: 9/9 aprobadas, incluidas teclado, axe, plegado, lienzo completo y edición/exportación GLB. Capturas inspeccionadas en un lote de escritorio 2D/3D y móvil; una confirmación 3D después del compositor. La inspección de hover registra textDecorationLine=none y transform=none.

## Datos matemáticos y estado del inspector — 2026-10-14

Se añadió MathPanel como componente independiente, con botón SVG Σ abajo a la derecha. Empieza cerrado; muestra fase normalizada, ángulo 360t, período 8/speed, frecuencia base speed/8, cantidad de componentes, máximo |k| seleccionado y coordenadas de store.evaluate(t). RMS y error máximo sólo aparecen cuando existe una referencia, con explicación para composición manual. Lee la misma fase reactiva actualizada a 10 Hz y no calcula mientras está cerrado o hay análisis pendiente. No añade RAF, timers ni análisis Fourier.

inspectorOpen ahora pertenece al servicio de sesión StudioStore: cerrar el inspector en 2D lo mantiene cerrado al pasar a 3D y volver, y una apertura explícita también se conserva. Las preferencias no se mezclan con documentos, historial ni JSON.

En escritorio, el inspector reduce altura al abrir el panel matemático; en móvil éste queda por encima del transporte. El contenido desplazable tiene tabindex=0 para lectura y scroll por teclado.

Evidencia: mathReadoutTracksPhaseAndInspectorStaysCollapsedAcrossModes verifica t=0.25 → 90°, velocidad 2× → período 4 s, actualización al reproducir, conservación del inspector en ambos sentidos, composición manual 3D, tamaño móvil, axe y scroll por teclado. La versión ampliada pasó en Chromium, Firefox y WebKit (3/3). La selección UI previa pasó 12/12; unitarias 42/42. Build y lint exit 0; detector Impeccable [] antes del ajuste de foco. Capturas finales math-panel-desktop.png y math-panel-mobile.png inspeccionadas.

## Selecciones visuales y móvil — 2026-10-14

Se reemplazaron los 15 select nativos del estudio, exportación e importación por OptionStrip: filas de iconos, miniaturas matemáticas de las curvas reales, planos/cámaras propios, muestras y resolución con cifras, y colores como muestras. Cada opción tiene nombre accesible; las selecciones persistentes muestran aria-pressed. Las muestras de curvas y composiciones son acciones, sin atribuirles selección falsa al editar/importar otra fuente.

Los tooltips CDK usan popover inline para conservar contexto semántico y escapar al recorte del inspector. La velocidad abre una fila de cinco opciones desde un botón compacto; conserva foco, admite Escape y devuelve el foco al cerrar. Se utilizaron las dependencias CDK ya instaladas. En táctil se evita el hover pegajoso y se conservan nombres accesibles y foco de teclado.

Barra inferior: 54 px medidos en escritorio y móvil, slider con área de entrada de 44 px, leyenda independiente de 12 px y 8 px de separación vertical. Opciones de 44×44 px mínimo; en pantallas estrechas se permite salto de fila. Inspector y matemáticas se alternan en móvil; en apaisado bajo se colocan lado a lado. Sin select restantes, sin fuentes ni imágenes externas.

Verificación: 42 unitarias aprobadas; lint y build exit 0. Selección final de 12 pruebas de navegador aprobadas en Chromium/Firefox/WebKit: fullViewportWorkspaceAndCollapsibleChrome, mathReadoutTracksPhaseAndInspectorStaysCollapsedAcrossModes, visualChoicesAndCompactDockStayUsableOnMobile, savedViewAndTransparentPngOptions. La nueva prueba mide botones, altura del dock, leyenda, separación de paneles, tooltip dentro del viewport, cambio de cámara, velocidad y axe del selector abierto en 360×800, 320×640 y 844×390. Confirmación visual adicional con hasTouch/isMobile en 320 y 360 px. Detector Impeccable [] antes del último pulido táctil. Capturas: visual-options-desktop.png, visual-options-mobile.png, visual-options-small.png; capturas por motor para apaisado en docs/screenshots. Publicación externa sigue aplazada.

## Cabecera, raíles y animación exportable — 2026-10-14

La cabecera ocupa todo el borde superior. Herramientas, inspector y columna de zoom/cámara comparten `--chrome-top`, a 12 px bajo la cabecera; las vistas de cámara también se seleccionan desde el raíl derecho. El inspector conserva su estado al alternar dimensión. Al abrirlo, se despliegan todas sus secciones sólo desde 1200×850; en tamaños menores empieza con «El punto de partida». Los cambios manuales se conservan mientras no cambie la categoría de tamaño ni se vuelva a abrir.

En móvil, el inspector sustituye temporalmente el raíl izquierdo y deja accesible el raíl derecho. Los controles largos se desplazan internamente en poca altura. Los avisos tienen una banda reservada bajo la cabecera, para no cubrir inspector, cámara, matemáticas o reproducción. El nombre es un campo integrado: confirma tras 700 ms de inactividad, al perder foco o con Enter; recorta espacios y usa «Sin nombre» si queda vacío. El estado de guardado aparece a su derecha.

El video funciona en 2D y 3D con MediaRecorder según soporte: 1280×720, WebM o MP4, un ciclo completo de duración `8 / speed` segundos. Usa un renderer y una instantánea independientes; no mueve fase, cámara ni reproducción del documento activo. Se impide iniciar mientras el análisis está ocupado y se puede cancelar. La prueba nueva decodifica el archivo y compara dos fotogramas, además de verificar resolución y fase original.

2D conserva el corazón inicial. 3D inicia con un nudo espacial de cinco lóbulos y tubo iluminado, con órbitas y vectores disponibles en apariencia. Las líneas 3D no escriben profundidad; original, reconstrucción y trazo tienen orden explícito, conservando prueba de profundidad contra la escultura. Se acota mejor el plano cercano de cámara y se conserva el grid sin escritura de profundidad. No se separa artificialmente la geometría fuente para evitar coincidencias.

Skills aplicadas: Impeccable layout/craft-floor, brainstorming sobre el brief explícito, code-testing para regresiones del shell, systematic-debugging y verification-before-completion. Evaluación de layout y revisión estática independientes. Sin dependencias nuevas. Detector Impeccable: `[]`. El build conserva una advertencia de CSS del shell (13.65 KiB frente al umbral de aviso de 12 KiB; límite de error 16 KiB), sin ampliar presupuestos.

Verificación final: 42 unitarios aprobados y 13 comprobaciones de navegador aprobadas (2 variantes táctiles omitidas fuera de Chromium), con video reproducido en Chromium/Firefox y fallback explícito en WebKit. Los detalles y las limitaciones de la suite general están registrados en docs/verification.md. La emulación táctil añade acciones tap, conservación de inspector y selección de cámara.

## Dibujo libre y selección de ejemplos

El borrador 2D acumula varios trazos sin reutilizar la geometría anterior. Reproducir analiza el borrador antes de iniciar el reloj; por defecto recorre el camino de vuelta para cerrar el ciclo. La animación conecta los trazos por orden: no hay separación matemática de movimientos con lápiz levantado. La goma vacía el borrador; cancelar recupera el documento anterior. Guardar o cambiar de dimensión confirma un borrador válido sin reproducirlo; un borrador vacío se descarta. Exportar queda deshabilitado hasta terminar el dibujo.

La selección de ejemplos se deriva de la geometría, independientemente del nombre y de los identificadores de círculos manuales. Esto conserva el estado al importar y deshacer, y evita marcar un ejemplo cuando el usuario modifica sus puntos.

## Capturas y exportación

El panel separa imágenes, proyecto y video, con opciones plegables y vista previa. PNG y video comparten el mismo generador de escenas aisladas: fondo gris oscuro por defecto, negro opcional, cuadrícula independiente, zoom entre 0.25× y 3× y formato horizontal, cuadrado o vertical. PNG y SVG admiten transparencia; SVG conserva solo la curva vectorial, fondo y cuadrícula. La imagen ofrece resolución 1× o 2×. El encuadre se puede ajustar al dibujo o copiar de la cámara del editor. Las opciones de imagen y video son independientes y no modifican el documento ni el reloj del editor.

## Precisión, edición y color del trazo

La selección de términos se agrupa en intervalos de 80 ms y usa un estado de cálculo local: no cambia la opacidad de Guardar/Reproducir ni interrumpe el reloj. Durante un análisis de fuente, solo ese slider queda bloqueado para no cancelar el análisis pendiente.

Los dibujos libres usan 2048 muestras y reciben una cantidad de términos según el espectro: error RMS normalizado menor o igual a 0.0015 y suma de radios omitidos menor o igual a 0.02. El usuario conserva el ajuste manual y puede volver a la recomendación. La cuenta depende de la geometría, no de un 64 fijo ni del número bruto de eventos del ratón.

Editar trazo permite deformar suavemente puntos cercanos y añadir trazos con el lápiz. Los índices de inicio de cada trazo se conservan opcionalmente en V2; V1 omite esa información y el modo de color. El modo RGB colorea la reconstrucción y las órbitas según la fase; PNG/video capturan ese color, SVG conserva el color base. La exportación usa líneas más contrastadas, grosor ajustable y Line2/LineSegments2 en 3D. Los estilos de base y las adaptaciones del estudio se separan en dos archivos manteniendo su cascada y los presupuestos originales.
