# Epicycle Studio — Pendientes

Actualizado: 2026-10-16, America/Guatemala.

El producto 2D/3D está implementado localmente. Se retiraron del plan las etapas de construcción completadas; las evidencias se conservan en [verificación](docs/verification.md) y [convenciones matemáticas](docs/math-conventions.md). Un build local no acredita publicación ni hardware físico.

## T18 — Rendimiento y accesibilidad pendientes

- [ ] Medir escenas estándar y máximas durante 30 segundos tras calentamiento, separando cálculo, tubo y render. Objetivos: p95 <=20 ms en escritorio y <=40 ms en móvil estándar; registrar desviaciones.
- [ ] Medir máximos sostenidos N=2048 en los tres motores, tareas largas y memoria heap/GPU; las mediciones cortas existentes no acreditan estos casos.
- [ ] Probar Android e iOS/Safari físicos, lápiz, lector de pantalla y zoom real al 200 %. Registrar dispositivo, navegador y resultados.
- [ ] Medir rendimiento y batería en móvil real. Mantener explícita la brecha mientras no se disponga de él.

## T11/T19 — Publicación en Cloudflare Pages

- [ ] Subir el artefacto preparado a la cuenta/proyecto elegidos por el usuario y registrar la URL HTTPS.
- [ ] Verificar rutas directas y recargas de `/studio/2d`, `/studio/3d` y `/learn`, MIME del worker y carga diferida de 3D/exportadores en el alojamiento.
- [ ] Verificar guardado/recuperación, importación V1/V2, enlaces y exportaciones SVG/PNG/GLB/video desde una sesión limpia alojada.
- [ ] Comprobar errores de red durante carga diferida, conservación del documento y reintento; ningún asset JavaScript debe recibir HTML por una regla SPA incorrecta.
- [ ] Confirmar headers, caché de HTML/archivos con hash y política CSP en el proveedor antes de imponerla; comprobar actualización e invalidación.
- [ ] Probar la URL desde un segundo dispositivo y documentar fecha, versión y evidencia.
- [ ] Ejecutar CI alojada y validar el workflow con actionlint. La configuración local no sustituye una ejecución en GitHub.
- [ ] Conservar un artefacto V2 anterior compatible y comprobar rollback sin convertir datos V2 destructivamente a V1.

## T20 — Cierre público y operativo

- [ ] Completar la guía de publicación con URL, fecha, versión y comprobaciones HTTPS reales.
- [ ] Revisar RF01–RF22 contra evidencias vigentes; mantener pendiente cualquier criterio sin comprobación. La compatibilidad V1 se acredita por archivos/fixtures, no por un build público anterior inexistente.
- [ ] Recorrer el producto alojado desde un navegador limpio: dibujar, reconstruir, guardar, recargar, compartir, pasar a 3D, editar profundidad, generar tubo, exportar GLB y abrirlo.
- [ ] Cerrar la entrega pública después de las comprobaciones anteriores y documentar límites conocidos y recuperación.

## Reglas vigentes

Angular standalone, TypeScript estricto y SPA estática. Matemática pura independiente de Angular/DOM/render; doble precisión y eje Y positivo hacia arriba. FFT sólo al cambiar geometría/análisis. Resultados de worker obsoletos nunca reemplazan el trabajo vigente. Guardado, carga y cambios de dimensión preservan la fuente; una proyección crea una copia. Los proyectos personales permanecen en el navegador y no se incluyen en la publicación. Ningún criterio se cierra sólo por existir código.

Para subir el build: [guía de Cloudflare Pages](docs/release.md). La publicación la realizará el usuario.
