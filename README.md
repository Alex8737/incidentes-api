# Plataforma de incidentes — Reto 4 (Unidad 8): integración, despliegue y defensa

**Autor:** Alex Logacho · Ingeniería en Ciberseguridad · PUCE · Versión **4.0.0** (`v4.0.0`)

Plataforma para registrar y dar seguimiento a incidentes de seguridad informática: API REST (Express + Sequelize), autenticación JWT con roles,
front-end en JavaScript puro, **HTTPS, configuración por entorno, logs estructurados, health check y métricas**, lista para desplegar en Render con PostgreSQL.

| | |
|---|---|
| **URL desplegada** | `https://________.onrender.com` ← complete tras el despliegue |
| **Salud** | `/api/health` |
| **Repositorio** | `https://github.com/<usuario>/incidentes-api` (etiqueta `v4.0.0`) |

## Documentación de la entrega

| Documento | Contenido |
|---|---|
| [`docs/DOCUMENTACION_TECNICA.md`](docs/DOCUMENTACION_TECNICA.md) | Arquitectura, instalación, variables, base de datos, API, seguridad, monitoreo, pruebas, reversión, limitaciones |
| [`docs/MANUAL_USUARIO.md`](docs/MANUAL_USUARIO.md) | Acceso, crear, actualizar, consultar, roles y solución de problemas |
| [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md) | GitHub → Render paso a paso, pruebas en producción, plan de reversión |
| [`docs/DEFENSA.md`](docs/DEFENSA.md) | Guion, mapa requisito → evidencia, preguntas probables, limitaciones, lecciones, contingencia |
| [`docs/evidencias/`](docs/evidencias/) | Registro de pruebas en producción y reportes de verificación |
| [`CHANGELOG.md`](CHANGELOG.md) | Qué cambió en cada versión |

## Inicio rápido (local)

```bash
npm install
npm run db:preparar     # .env + migraciones + cuentas y datos de demostración
npm start               # http://localhost:3000   (usuario admin · Admin-Demo-2026!)
npm test                # pruebas · npm run lint · npm run evidencia
```

**Producción:** variables en el panel de Render (ver `.env.example` y `docs/DOCUMENTACION_TECNICA.md` §4) · comando de inicio `npm run start:prod` ·
verificación `npm run verificar -- https://<servicio>.onrender.com`.

---

# Historial: Reto 3 (Unidad 7) — pruebas, optimización, refactorización y documentación

## 1. Cómo ejecutarlo

Requisitos: **Node.js 18.18 o superior**.

```bash
npm install        # dependencias (incluye jest y eslint)
npm run setup      # crea .env, aplica migraciones y carga datos iniciales
npm start          # http://localhost:3000
```

| Comando | Qué hace |
|---|---|
| `npm test` | Todas las pruebas con Jest (unitarias + integración) |
| `npm run test:unit` | Solo unitarias: rápidas, sin base de datos ni servidor |
| `npm run test:integracion` | API completa contra SQLite en memoria (usa las migraciones reales) |
| `npm run test:cobertura` | Cobertura en `coverage/` (las reglas de negocio exigen ≥ 90 %) |
| `npm run lint` · `npm run lint:fix` | ESLint sobre todo el proyecto · corrige lo que se puede automáticamente |
| `npm run evidencia` | Pruebas + ESLint guardados sin colores en `docs/reportes/` |
| `npm run generar -- 5000` | Inserta 5000 incidentes de prueba (`-- --limpiar` borra solo los generados) |
| `npm run medir:antes` · `npm run medir:despues` | Mide consulta, red e imágenes con el mismo procedimiento → `docs/reportes/medicion-*.txt` |
| `npm run db:migrate` · `db:seed` · `db:reset` | Migraciones y datos iniciales |

> Windows con PowerShell que bloquea `npm`: usar `npm.cmd` o el terminal «Command Prompt».

---

## 2. Defectos encontrados con DevTools y corregidos

Cada defecto se reprodujo en Chromium (pestañas *Network*, *Console* y *Elements*) y quedó cubierto por una prueba de regresión.
Capturas y resultados: `docs/capturas/` y `docs/reportes/devtools-resultados.json`.

| # | Defecto (antes) | Evidencia | Corrección (después) | Prueba |
|---|---|---|---|---|
| 1 | El contador mostraba **50** aunque hubiera 155 incidentes y no había forma de ver la página 2 | *Network*: la respuesta de `/api/incidentes` traía `total: 155, paginas: 4`, pero `api.js` descartaba todo salvo `datos` | `api.listar` devuelve `{datos, total, pagina, paginas}`; nuevo componente de paginación; el contador usa el total real | `modelo.test.js`, `componentes.test.js`, `regresion.test.js` |
| 2 | **XSS en el filtro de búsqueda**: el texto escrito se insertaba sin escapar en `value="…"` y, al volver a iniciar sesión, un `"><img onerror=…>` se ejecutaba | *Elements*: apareció un `<img>` dentro del formulario de filtros; *Console*: se disparó el `onerror` | `Filtros.js` escapa con `esc()`; `cerrarSesion()` borra filtros, datos y estadísticas del usuario anterior | `componentes.test.js`, `modelo.test.js` |
| 3 | **Acciones que el rol no puede usar**: el visor veía «Editar», «Eliminar» y el cambio de estado, y el servidor las rechazaba con 403 | *Elements*: los tres controles presentes en cada tarjeta del visor (el 403 ya lo comprueban las pruebas de seguridad) | El servidor devuelve `permisos` en `/auth/login` y `/auth/me`; la tarjeta solo muestra lo que el rol puede hacer | `permisos.test.js`, `componentes.test.js`, `regresion.test.js` |
| 4 | **Búsqueda con `%` y `_`**: buscar «SRV_WEB» o «100%» devolvía **0 resultados** aunque existían | `docs/reportes/defecto4-like-sqlite.txt` (consulta ejecutada en SQLite real) | SQLite no usa `\` como escape en `LIKE`, así que el patrón buscaba una barra inversa literal. Ahora se escapa con `!` y la consulta declara `ESCAPE '!'` | `incidente.reglas.test.js`, `regresion.test.js` |
| 5 | **Condición de carrera en la búsqueda**: al escribir «ran» y luego «ransomware», la respuesta lenta de «ran» llegaba después y pisaba el resultado correcto | *Elements*: con «ransomware» escrito, la lista mostraba los resultados de «ran» (la petición `q=ran` terminaba después que `q=ransomware`) | Cada consulta nueva cancela la anterior con `AbortController` | `modelo.test.js` |
| 6 | **URL de la API fija en el puerto 3000**: con `PORT=8080` el front llamaba a `localhost:3000` y fallaba | *Console*: `net::ERR_CONNECTION_REFUSED` hacia `http://localhost:3000/api/health` con el front en otro puerto | `resolverBaseUrl()` usa el mismo origen (`/api`) salvo desde Live Server | `componentes.test.js` |

---

## 3. Pruebas (Jest)

Dos proyectos en `jest.config.js`, porque el código corre en entornos distintos:

- **servidor** — CommonJS de Node: unitarias (`tests/unit/*.test.js`) e integración con `supertest` (`tests/integracion/`).
- **front** — módulos ES del navegador (`tests/unit/frontend/`), transformados con `babel-jest` y probados con una API falsa (`jest.fn`).

Reglas de negocio cubiertas (funciones puras, sin base de datos):

| Archivo | Regla |
|---|---|
| `src/models/incidente.reglas.js` | Validación de título (5–120), catálogos, límites de texto, bloqueo de asignación masiva, normalización, valores por defecto del `PUT`, paginación, patrón `LIKE`, resumen de estadísticas |
| `src/models/permisos.js` | visor = lectura · analista = lectura y escritura · admin = todo; denegar por defecto |
| `src/models/usuario.reglas.js` | Credenciales: campos permitidos, longitudes, usuario en minúsculas |
| `src/middleware/errorHandler.js` | Cada excepción → su código HTTP; los 5xx no filtran detalles |

---

## 4. ESLint

`eslint.config.js` (formato *flat config*, sin plugins adicionales) define tres entornos: servidor (CommonJS), pruebas (Jest) y navegador (módulos ES).
Además de las reglas de errores comunes (`no-undef`, `no-unused-vars`, `eqeqeq`, `prefer-const`…) incluye **métricas de mantenibilidad**
(`complexity` ≤ 10, `max-lines-per-function` ≤ 40, `max-depth`, `max-params`) que guiaron la refactorización.

Reporte antes/después: `docs/reportes/eslint-antes.txt` y `docs/reportes/eslint-despues.txt`.

---

## 5. Rendimiento: qué se midió y qué se mejoró

`scripts/medir-rendimiento.js` usa una base temporal con 20 000 incidentes y el mismo procedimiento para «antes» (`linea-base/`) y «después».

| Medición | Antes | Mejora aplicada |
|---|---|---|
| **Consulta** — estadísticas del tablero | 4 consultas SQL (`COUNT` + 3 `GROUP BY`) | 1 sola consulta `GROUP BY estado, severidad, prioridad` y el resumen se arma con una función pura |
| **Imagen** — logotipo de la cabecera | `logo.png` de 1024×1024 px (≈ 81 kB) mostrado a 40 px, sin `width/height`; sin favicon (404 en cada carga) | `logo-80.webp` (80×80 px, ≈ 3 kB), `width/height` declarados, favicon propio y `Cache-Control: public, max-age=604800` |
| **Red** — `GET /api/incidentes` (50 registros) | JSON sin comprimir | Compresión gzip (`compression`) a partir de 1 kB |

Los números exactos (tiempo mediano, bytes y plan de ejecución) están en `docs/reportes/medicion-antes.txt` y `medicion-despues.txt`.

---

## 6. Arquitectura MVC

```
src/
├── models/          MODELO  incidente.reglas.js · permisos.js · usuario.reglas.js (reglas puras)
│                            incidente.model.js · usuario.model.js · catalogos.js · index.js (ORM)
├── repositories/    consultas a la base (usa las reglas, no define reglas propias)
├── controllers/     CONTROLADOR  HTTP ↔ repositorio, sin SQL
├── routes/          rutas y permisos por rol (rolesPara)
├── middleware/      validarIncidente.js / validarLogin.js (traducen HTTP ↔ reglas) · auth · errorHandler · logger
└── config/ · database/ · utils/
public/js/
├── incidentes/      modelo.js (estado + reglas + API) · vista.js (solo dibuja) · controlador.js (eventos)
├── components/      funciones que devuelven HTML (se prueban sin navegador)
├── api.js           acceso HTTP
└── app.js           arma las piezas y gestiona la sesión
tests/               unit/ · unit/frontend/ · integracion/ · helpers.js
linea-base/          copia del código original, solo para medir el «antes»
docs/                reportes/ (pruebas, ESLint, mediciones) · capturas/ · esquema/ · pruebas.http
```

### Módulo refactorizado

- **Servidor — validación de incidentes.** `src/middleware/validarIncidente.js` mezclaba HTTP con reglas de negocio (136 líneas, una función de complejidad alta).
  Las reglas pasaron al **modelo** (`incidente.reglas.js`, funciones puras con pruebas unitarias) y el middleware quedó como un traductor delgado.
  `validarLogin.js` y las rutas siguieron el mismo camino (`usuario.reglas.js`, `permisos.js`).
- **Front-end — `public/js/app.js`.** Un solo archivo de 266 líneas con estado, DOM, eventos y llamadas a la API se separó en **modelo / vista / controlador**.
  El modelo no toca el DOM (se prueba con una API falsa); la vista solo dibuja; el controlador conecta eventos con el modelo.

---

## 7. Configuración segura, API y errores

- Toda la configuración sale de `.env` (plantilla: `.env.example`); no hay credenciales en el código. `src/config/env.js` valida al arrancar y solo informa el **nombre** de la variable que falte.
- `DB_DIALECT=sqlite` (por defecto) o `mysql` / `postgres` sin cambiar código.
- Autenticación JWT (HS256, expiración configurable), contraseñas con bcrypt, CORS restringido, cabeceras de `helmet` y límite de 10 kB por petición.

Base: `http://localhost:3000/api` (todas las rutas de incidentes exigen `Authorization: Bearer <token>`).

| Método | Ruta | Descripción | Rol mínimo | OK |
|---|---|---|---|---|
| POST | `/auth/login` | Inicia sesión; devuelve token, datos y `permisos` | — | 200 |
| GET | `/auth/me` | Perfil de la sesión y `permisos` | cualquiera | 200 |
| GET | `/health` | Estado del servicio y de la base | — | 200 |
| GET | `/incidentes` | Lista con filtros `estado, prioridad, severidad, categoria, q`, paginación `pagina, limite` y orden `orden, dir` | visor | 200 |
| GET | `/incidentes/:id` | Obtener uno | visor | 200 |
| GET | `/incidentes/stats` · `/incidentes/catalogos` | Totales (GROUP BY) · valores permitidos | visor | 200 |
| POST | `/incidentes` | Crear | analista | 201 |
| PUT · PATCH | `/incidentes/:id` | Reemplazo completo · actualización parcial | analista | 200 |
| DELETE | `/incidentes/:id` | Eliminar | admin | 204 |
| GET | `/logs` | Registro de peticiones | admin | 200 |

Errores con formato único `{ ok: false, error: { mensaje, estado, detalles?, referencia? } }`:
400 validación · 401 sin sesión · 403 sin permiso · 404 · 409 conflicto · 413 cuerpo grande · 503 base no disponible ·
500 interno (solo un id de referencia, sin detalles técnicos).

---

## 8. Documentación técnica adicional

- `docs/reportes/` — pruebas, cobertura, ESLint y mediciones (antes/después).
- `docs/capturas/` — evidencia de DevTools de los defectos y de sus correcciones.
- `docs/esquema/schema.sql` — esquema de la base · `docs/pruebas.http` — ejemplos para la extensión REST Client.
- `tests/incidentes.test.js` y `tests/migraciones.test.js` (raíz de `tests/`) son archivos antiguos (`node:test`) reemplazados por `tests/integracion/`; Jest no los ejecuta y se pueden borrar.
