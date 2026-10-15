# Aprender y crear

## Primer dibujo

1. Abre el estudio 2D; aparece un corazón ya calculado.
2. Pulsa Reproducir. Pausa y mueve la línea temporal: el prefijo del trazo representa esa fase del ciclo.
3. Reduce Epiciclos a unos pocos; aumenta después. El término constante conserva el centro aunque se eliminen componentes.
4. Elige Dibujar, traza una curva y suelta. La línea discontinua muestra el segmento de cierre propuesto. Conectar extremos y Regresar son decisiones diferentes.
5. Guarda el proyecto y descarga JSON. Biblioteca abre y duplica proyectos; eliminar pide una acción explícita.

## Primera curva espacial

1. Abre Espacio 3D y explora el nudo trébol. Cambia a Frontal, Superior o Lateral para entender la profundidad.
2. Crear curva espacial inicia cuatro controles no coplanarios. Abre su tabla y modifica Z del tercer punto.
3. Con Editar puntos activo, elige un plano y profundidad fija. Un clic añade un punto en ese plano; los campos X/Y/Z ofrecen una alternativa de teclado. Selecciona un marcador para moverlo con el manipulador.
4. Polilínea y Spline centrípeta producen distintas geometrías: la fuente conserva sus puntos.
5. Activa Escultura tubular para obtener una malla iluminada. GLB descarga sólo la escultura estática. JSON conserva los puntos y ajustes.

## Una máquina propia

Componer inicia dos círculos. Añade, duplica, elimina o reordena filas. Radio es tamaño; frecuencia es vueltas por ciclo; frecuencia negativa invierte el giro; fase está en grados. Las frecuencias deben ser enteras y distintas de cero. El centro es independiente de los círculos.

En 3D, XY/XZ/YZ ofrecen planos conocidos. Orientación del plano permite editar la normal; el modelo construye y valida una base ortonormal. Una normal cero se rechaza. Deshacer y Rehacer restauran geometría; una nueva edición elimina la rama de rehacer.

## Conservar y recuperar

Guardar sólo informa éxito después de la transacción. Las ediciones confirmadas generan un borrador tras un segundo. Un borrador más reciente puede recuperarse al abrir; el error de almacenamiento mantiene la creación en memoria y ofrece JSON. Borrar los datos del navegador elimina sus copias: conserva archivos externos.

Abrir JSON o un enlace muestra una vista previa y crea una copia con ID nuevo. Archivos excesivos, versiones futuras, coordenadas no finitas y bases inválidas se rechazan antes de cambiar la escena. V2 admite V1; la exportación V1 está disponible para 2D. La biblioteca conserva backups al reemplazar una versión guardada.

## Compartir

PNG captura la escena; SVG exporta la curva completa como path muestreado; GLB exporta el tubo. La fase del lápiz no recorta SVG ni GLB. El proyecto JSON conserva la edición.

Copiar enlace funciona para creaciones compactas: el límite es 6000 bytes / 8000 caracteres. Si el proyecto no cabe, se ofrece JSON sin reducir puntos. El fragmento no se envía como parte de la petición HTTP; cualquiera que posea el enlace puede leer la creación.

El SVG de entrada admite 1–32 paths, viewBox válido, un subtrazo por path y ningún transform. Rechaza scripts, entidades, imágenes, referencias externas y eventos. Aplana las transformaciones en tu editor antes de importar. La selección y el cierre son explícitos.

## Video y limitaciones

Grabar un ciclo utiliza una escena temporal de 1280 × 720 durante 8 segundos. El formato depende de MediaRecorder; no se promete MP4 en todos los navegadores. Cancelar y ocultar la pestaña detienen la grabación y liberan tracks. La grabación puede perder frames.

La tolerancia del tubo se aplica a su línea central. Si necesita más de 2048 segmentos, se rechaza el GLB hasta reducir componentes o elegir una tolerancia mayor. Cúspides y tangentes degeneradas mantienen la alternativa de línea. El tubo no se garantiza apto para fabricación.

Sin WebGL el documento permanece editable, con proyección plana y descarga JSON. Esto es una curva parametrizada, no una reconstrucción de fotografías ni un editor CAD.
