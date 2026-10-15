# Preparación de publicación

**Estado:** preparado para que el usuario lo suba a Cloudflare Pages. Aún no hay una URL pública comprobada ni un despliegue remoto realizado desde esta sesión.

## Workers conectado a GitHub

El despliegue en `epicycle-studio.josuewong797.workers.dev` usa Workers con archivos estáticos. `wrangler.jsonc` fija la raíz en `dist/epicycle-studio/browser` y habilita el fallback SPA para las rutas Angular. El comando de despliegue del panel es `npx wrangler deploy`; Wrangler ejecuta `npm run build` mediante `build.command`, incluso si no hay un comando de build separado en el panel. Si el panel también ejecuta `npm run build`, el build se repetirá; ese paso separado puede dejarse vacío.

La autodetección anterior seleccionaba `dist/`, por lo que publicaba `/epicycle-studio/browser/index.html` y la raíz devolvía 404. Mantener `wrangler.jsonc` en Git evita depender de esa autodetección. Las instrucciones de Pages siguen siendo válidas para carga manual. No añadir la regla `/* /index.html 200`: Workers la rechaza como bucle infinito (error 100324).

## Carga manual

1. En el panel de Cloudflare, abre **Workers & Pages**, crea una aplicación de **Pages** y elige la opción de cargar archivos precompilados (Direct Upload).
2. Selecciona `artifacts/epicycle-studio-cloudflare-pages.zip`, o arrastra la carpeta `dist/epicycle-studio/browser`.
3. El ZIP contiene `index.html`, `_headers`, favicon, licencias de terceros y archivos con hash directamente en su raíz. No subas el repositorio ni la carpeta `dist` superior.
4. Despliega y realiza las comprobaciones HTTPS de esta guía desde la URL que te entregue Pages.

Cloudflare admite una carpeta o un ZIP para la carga manual: [documentación oficial de Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/).

## Artefacto

```sh
npm ci
npm run lint
npm run format:check
npm run test:ci
npm run build
npm run test:e2e
```

Salida comprobada: `dist/epicycle-studio/browser`. Publicar sólo esa carpeta; no incluir `.tools`, `.work`, fuentes, capturas de pruebas ni datos locales. El dominio matemático y archivos JSON no contienen credenciales ni requieren backend.

En Cloudflare Pages: comando `npm run build`, directorio `dist/epicycle-studio/browser`, Node 24.15.0 compatible. El build incluye `_headers` y no genera `_redirects`: Workers utiliza `assets.not_found_handling = "single-page-application"`; Pages utiliza su fallback SPA nativo al no existir un `404.html`. La política CSP está en modo reporte; probarla en el alojamiento antes de imponerla. Los estilos Angular necesitan su política correspondiente. Workers se sirven como JavaScript y los exportadores se cargan por separado.

La suite local sirve HTTP real con el mismo artefacto. Las rutas /studio/2d, /studio/3d y /learn deben abrir directamente. Assets inexistentes con extensión devuelven 404 en la preview; no se les entrega HTML.

## Antes de promover a público

1. Elegir cuenta/proyecto y crear una URL de preview autorizada.
2. Verificar HTTPS, rutas recargadas, carga del worker y lazy 3D; abrir archivos V1/V2, enlace, SVG, PNG y GLB desde un contexto limpio.
3. Confirmar cache no persistente de HTML y assets con hash inmutables. Ajustar las reglas reales del proveedor; una preview local no prueba sus headers.
4. Probar desde un segundo dispositivo y registrar fecha, revisión y URL en este archivo.
5. Promover el mismo artefacto validado y conservar el build anterior para rollback.

## Recuperación

Conservar JSON y backups antes de actualizar formato. Si una versión falla, volver al artefacto V2 anterior compatible; no convertir registros V2 destructivamente a V1. Antes de migrar mayores, repetir identidades Fourier, migración/importación, exportaciones y recorrido de ambos modos. Un rollback debe conservar la lectura/exportación de los datos nuevos.

El workflow `.github/workflows/quality.yml` ejecuta instalación, lint/formato, unitarios, build y E2E en Ubuntu y guarda informes. El repositorio de entrega es [wong17/epicycle-studio](https://github.com/wong17/epicycle-studio). La ejecución alojada se comprueba en la pestaña Actions; no se deduce de los resultados locales.
