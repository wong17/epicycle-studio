# Crear desde…

Ampliación autorizada del editor existente: galería, texto de una sola línea, SVG por trazos y fotografías mediante contornos o arte TSP. Mantener fondo gris oscuro, acento lima, controles con iconos y ayudas, experiencia móvil y vista previa antes de reemplazar el documento.

## Contrato

- Un componente standalone `features/creation/create-drawing` posee el formulario y borrador; emite `DrawingDraft` al confirmar. El shell únicamente abre el diálogo e integra una nueva fuente 2D. Desde 3D se abre una copia en 2D.
- `domain/creation` genera ilustraciones y texto y conecta segmentos sin levantar el lápiz. `domain/image-tracing` procesa matrices sin DOM. `infrastructure/creation` decodifica SVG/fotos y gestiona worker/cancelación. Ninguna imagen se transmite a servidores.
- Dos recorridos de foto: contornos para dibujos lineales; densidad tonal y recorrido continuo para retratos/paisajes. Puentes entre componentes visibles y cierre por regreso sobre la línea; nunca fingir que un salto invisible es trazo continuo.
- La vista previa muestra geometría real y conexiones, selección explícita, mensajes de error y carga. Cancelar conserva la creación previa. Generar no inicia descargas ni sobrescribe archivos guardados.
- Procesamiento acotado, máximo 10000 puntos fuente, análisis hasta 2048 muestras y recomendación automática de epiciclos. Detalle no equivale a reproducción fotográfica perfecta.
- IA: excluida por decisión expresa del usuario. Texto significa nombres/frases convertidos a trazos; sin descripción generativa ni conexión a servicios.

## Calidad

Tipos públicos concretos, sin `any`, aserciones `never` ni cálculo de geometría en templates. Módulos pequeños por responsabilidad. Pruebas de geometría, entradas vacías/incorrectas, archivos no admitidos, cancelación, integración sin destruir borradores, acceso por teclado y móvil. Activar TypeScript y templates estrictos si las correcciones son acotadas. Build y lint sin avisos de aplicación; verificar en navegadores antes del push.
