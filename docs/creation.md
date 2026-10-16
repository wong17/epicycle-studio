# Crear desde…

Abre el botón **+** de la barra superior. El creador se carga bajo demanda y ofrece una vista previa real del recorrido antes de abrir un documento 2D nuevo. Desde 3D conserva la sesión espacial y abre una copia 2D.

## Galería y texto

Ocho ilustraciones originales: perfil, colibrí, valle, flor, nautilo, mariposa, ciudad y pez. Filtros por tema, selección visible y variaciones deterministas.

Texto convierte hasta 80 caracteres en letras de trazo simple. Se muestran mayúsculas y se simplifican acentos; admite números, puntuación y saltos de línea. No interpreta descripciones ni usa IA. Los trazos se unen por proximidad o siguiendo su orden original; los enlaces son parte visible del dibujo.

## SVG

Importar desde la barra superior y desde el creador usa la misma selección multitrazo. Admite paths con varios subtrazos, incluidos `m` relativos, y formas básicas: línea, polilínea, polígono, círculo, elipse y rectángulo. Hasta 256 KiB, 64 trazos y 4096 muestras distribuidas por longitud, con al menos ocho por trazo.

Requiere `viewBox`. Rechaza scripts, referencias externas, namespaces ajenos, texto, estilos, transformaciones y elementos no admitidos. Convierte el texto a paths y aplana las transformaciones en un editor vectorial antes de importar. Los fondos/cuadrículas marcados por el exportador de Epicycle Studio no se convierten en geometría al reimportar; igualmente se valida todo su contenido.

## Fotos

PNG, JPEG y WebP hasta 12 MiB y entre 2 y 4096 píxeles por lado. Se validan formato y dimensiones antes de decodificar. La foto permanece en el navegador, se reduce a una matriz de hasta 256 × 256 y se procesa en un Worker cancelable.

- **Línea continua:** distribución determinista de puntos según oscuridad, ruta de vecinos cercanos y refinamiento 2-opt acotado. Interpreta tonos mediante densidad de línea.
- **Contornos:** gradiente Sobel, supresión de bordes, cadenas de píxeles y conexiones entre componentes. Adecuado para imágenes contrastadas.

Detalle controla de 300 a 2200 puntos de salida. Contraste e inversión ayudan con imágenes claras/oscuras. Una imagen uniforme produce un mensaje en lugar de una curva ficticia. El resultado es una interpretación estilizada; el límite de 2048 muestras del análisis Fourier puede suavizar detalles muy pequeños. Sin Workers se muestra un error recuperable para fotos.

## Continuidad y conservación

Los contornos separados se conectan con segmentos visibles. Los recorridos abiertos vuelven sobre la misma trayectoria para cerrar el ciclo; no se añade una diagonal oculta después de la vista previa. La cantidad de epiciclos se recomienda al calcular.

Cancelar el creador conserva el documento actual. Antes de abrir uno nuevo se conserva el borrador anterior cuando tiene cambios. Los errores al conservar o calcular se muestran en el diálogo; un fallo del análisis restaura documento, geometría y estado de guardado anteriores, sin reproducir geometría obsoleta. Durante la apertura se bloquea un segundo envío y el cierre del diálogo.

## Organización

- `domain/creation`: tipos, generadores y conexión/normalización de recorridos.
- `domain/image-tracing`: procesamiento de matrices sin Angular ni DOM.
- `infrastructure/creation`: parser SVG, metadatos/decodificación de fotos y protocolo de Worker.
- `features/creation`: formulario standalone, vista previa y estados de interacción.
- El shell abre el componente diferido e integra el proyecto; no contiene algoritmos de generación.

TypeScript y plantillas Angular estrictos. Sin `any`, `$any` ni aserciones `never` en código de aplicación. La comprobación móvil de navegador no sustituye dispositivos físicos.
