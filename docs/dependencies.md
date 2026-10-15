# Dependencias resueltas

Node de ejecución: 24.15.0 local; Angular: 22.2.2. Versiones y licencias leídas de los manifiestos instalados. package-lock.json conserva la resolución exacta; usar npm ci.

| Paquete                   | Versión | Licencia declarada | Fuente                                                         |
| ------------------------- | ------- | ------------------ | -------------------------------------------------------------- |
| @angular/cdk              | 22.2.2  | MIT                | [npm](https://www.npmjs.com/package/@angular/cdk)              |
| @angular/common           | 22.2.2  | MIT                | [npm](https://www.npmjs.com/package/@angular/common)           |
| @angular/compiler         | 22.2.2  | MIT                | [npm](https://www.npmjs.com/package/@angular/compiler)         |
| @angular/core             | 22.2.2  | MIT                | [npm](https://www.npmjs.com/package/@angular/core)             |
| @angular/forms            | 22.2.2  | MIT                | [npm](https://www.npmjs.com/package/@angular/forms)            |
| @angular/platform-browser | 22.2.2  | MIT                | [npm](https://www.npmjs.com/package/@angular/platform-browser) |
| @angular/router           | 22.2.2  | MIT                | [npm](https://www.npmjs.com/package/@angular/router)           |
| fft.js                    | 4.0.4   | MIT                | [npm](https://www.npmjs.com/package/fft.js)                    |
| idb                       | 8.0.4   | ISC                | [npm](https://www.npmjs.com/package/idb)                       |
| rxjs                      | 7.8.2   | Apache-2.0         | [npm](https://www.npmjs.com/package/rxjs)                      |
| three                     | 0.186.1 | MIT                | [npm](https://www.npmjs.com/package/three)                     |
| tslib                     | 2.8.1   | 0BSD               | [npm](https://www.npmjs.com/package/tslib)                     |
| zod                       | 4.6.7   | MIT                | [npm](https://www.npmjs.com/package/zod)                       |
| @angular/build            | 22.2.2  | MIT                | [npm](https://www.npmjs.com/package/@angular/build)            |
| @angular/cli              | 22.2.2  | MIT                | [npm](https://www.npmjs.com/package/@angular/cli)              |
| @angular/compiler-cli     | 22.2.2  | MIT                | [npm](https://www.npmjs.com/package/@angular/compiler-cli)     |
| @axe-core/playwright      | 4.13.0  | MPL-2.0            | [npm](https://www.npmjs.com/package/@axe-core/playwright)      |
| @eslint/js                | 10.0.1  | MIT                | [npm](https://www.npmjs.com/package/@eslint/js)                |
| @playwright/test          | 1.64.1  | Apache-2.0         | [npm](https://www.npmjs.com/package/@playwright/test)          |
| @types/three              | 0.186.0 | MIT                | [npm](https://www.npmjs.com/package/@types/three)              |
| @vitest/coverage-v8       | 5.0.4   | MIT                | [npm](https://www.npmjs.com/package/@vitest/coverage-v8)       |
| angular-eslint            | 22.6.0  | MIT                | [npm](https://www.npmjs.com/package/angular-eslint)            |
| eslint                    | 10.12.0 | MIT                | [npm](https://www.npmjs.com/package/eslint)                    |
| fake-indexeddb            | 6.2.5   | Apache-2.0         | [npm](https://www.npmjs.com/package/fake-indexeddb)            |
| jsdom                     | 30.1.2  | MIT                | [npm](https://www.npmjs.com/package/jsdom)                     |
| prettier                  | 3.9.10  | MIT                | [npm](https://www.npmjs.com/package/prettier)                  |
| typescript                | 6.0.3   | Apache-2.0         | [npm](https://www.npmjs.com/package/typescript)                |
| typescript-eslint         | 8.71.2  | MIT                | [npm](https://www.npmjs.com/package/typescript-eslint)         |
| vitest                    | 5.0.4   | MIT                | [npm](https://www.npmjs.com/package/vitest)                    |

fft.js es CommonJS: sólo este paquete se permite explícitamente en el build. La matemática usa doble precisión; Three.js convierte geometría a Float32. Ningún recurso gráfico externo es necesario. El CLI genera Vitest 5.0.4 y TypeScript compatible; no se sustituyó su runner.
