# Epicycle Studio

Un laboratorio gráfico para dibujar, reconstruir y componer curvas con epiciclos en 2D y 3D. Angular administra los controles; un dominio TypeScript calcula Fourier; los workers realizan análisis y muestreo; Canvas y Three.js representan los resultados. Los proyectos se guardan en este navegador.

## Ejecutar

Requiere Node 24.15.0 o una versión compatible con Angular 22.2.2.

```sh
npm ci
npm run start
```

Abre http://127.0.0.1:4200/studio/2d. Para el artefacto de producción:

```sh
npm run build
npm run preview
```

En esta máquina hay un Node compatible local en `.tools/node_modules/node-win-x64/bin/node.exe`; los scripts lo usan automáticamente. En una instalación nueva se usa el Node del sistema. `.tools` no forma parte del producto.

## Crear

- Pulsa la goma **Limpiar lienzo** de la barra izquierda para quitar la figura y escribir o dibujar desde cero. También puedes elegir un ejemplo o pulsar **Dibujar**. Puedes levantar el lápiz y continuar con varios trazos. Pulsa **Reproducir** o **Animar dibujo** para reconstruirlos; se unen por orden y se regresa por el recorrido para cerrar el ciclo. También puedes conectar los extremos con el botón de cierre.
- Durante el dibujo, la goma permite **Limpiar y empezar de nuevo**; cancelar recupera la figura anterior. Los ejemplos seleccionados quedan resaltados.
- Pulsa **Reproducir** y cambia componentes, velocidad o posición temporal. La app siempre abre pausada.
- **Componer** permite añadir círculos y editar radio, frecuencia, fase y centro. En 3D también permite editar su plano y normal.
- **Espacio 3D** ofrece curvas espaciales, cámaras y edición numérica de puntos. **Editar puntos** permite añadir en un plano y mover marcadores.
- **Llevar una copia a 3D** conserva el original y muestra el error de reducción antes de confirmar.
- **Guardar** crea una copia local; **Proyecto JSON** descarga la fuente editable. PNG/SVG/GLB son resultados visuales. Los enlaces pequeños contienen la creación en el fragmento de URL.

[Guía de uso y aprendizaje](docs/learning.md) · [Convenciones matemáticas](docs/math-conventions.md) · [Evidencias y pendientes](docs/verification.md) · [Rendimiento](docs/performance.md) · [Publicación](docs/release.md)

Capturas actuales: [escritorio](docs/screenshots/studio-desktop.png), [móvil](docs/screenshots/studio-mobile.png) y [3D](docs/screenshots/studio-3d.png). Las capturas automáticas de las pruebas se generan en `test-results/`.

## Verificación

```sh
npm run lint
npm run format:check
npm run test:ci
npm run build
node scripts/run.mjs playwright install
npm run test:e2e
```

La suite de navegador sirve el build real por HTTP. Chromium, Firefox y WebKit son automatizados; WebKit en Windows no demuestra Safari/iOS físico. CI está preparada; su ejecución alojada requiere publicar el repositorio.

## Estructura

`src/app/domain` contiene preparación, FFT, evaluación, selección, errores y validación de proyectos. `infrastructure` contiene workers, IndexedDB y transferencia. `features` contiene estado, reloj, historial, canvas, escena espacial y aprendizaje. Los tests unitarios viven junto a sus módulos; los flujos de navegador están en `tests/e2e`.

`plan.md` contiene únicamente pendientes de validación, publicación y cierre. `docs/implementation.md` registra las decisiones y el trabajo realizado; `docs/verification.md`, las evidencias y límites de lo comprobado.

## Subir a Cloudflare Pages

El ZIP listo para carga manual está en `artifacts/epicycle-studio-cloudflare-pages.zip`. También se puede subir directamente la carpeta `dist/epicycle-studio/browser`. El archivo `index.html` y las reglas `_headers` quedan en la raíz del ZIP. La subida la realiza el usuario; no requiere backend.

Para reconstruir: `npm ci` y `npm run build`. Para integración Git en Pages: comando `npm run build`, salida `dist/epicycle-studio/browser`, Node indicado en `.nvmrc`. Ver [instrucciones de publicación y comprobaciones HTTPS](docs/release.md).
