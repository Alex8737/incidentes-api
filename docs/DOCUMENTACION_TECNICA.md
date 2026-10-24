# Documentación técnica — Plataforma de incidentes (v4.0.0)

**Autor:** Alex Logacho · Ingeniería en Ciberseguridad · PUCE · Desarrollo de Plataformas
**Versión del documento:** 4.0.0 · **Fecha:** 24/10/2026 · **Etiqueta de Git:** `v4.0.0`

Este documento permite **instalar, configurar, probar, desplegar y mantener** la solución. Los secretos se representan con nombres de ejemplo.

---

## 1. Arquitectura

```
                         HTTPS (Render termina TLS)
 Usuario ──► Navegador ─────────────────────────────►  Servicio web Node.js (Express)
              HTML + JS (módulos ES)                    │  ├─ /            front-end estático (public/)
                                                        │  ├─ /api/auth     login · perfil
                                                        │  ├─ /api/incidentes   CRUD (JWT + rol)
                                                        │  ├─ /api/health   salud (200/503)
                                                        │  └─ /api/logs · /api/metricas  (admin)
                                                        │
                                                        ├──► PostgreSQL gestionado (DATABASE_URL, red interna)
                                                        └──► Logs JSON a stdout → panel de logs de Render
```

**Decisión de diseño — un solo servicio para front y API.** Express sirve el front-end estático y la API bajo el mismo dominio HTTPS.
Ventajas: no hay CORS entre front y API, una sola URL para evaluar, y el front-end siempre corresponde a la versión de la API desplegada.
La alternativa (front en Vercel/Netlify + API en Render) se descarta aquí porque añade CORS, dos despliegues que pueden desalinearse y un segundo punto de fallo; sería la opción si el front necesitara una CDN o escalara por separado.

**Patrón MVC.** Modelo = reglas puras (`src/models/*.reglas.js`, `permisos.js`) + ORM; Controlador = `src/controllers`; Vista = front-end (`public/js/incidentes/vista.js` y `components/`).
`src/repositories` concentra las consultas; `src/middleware` traduce HTTP ↔ reglas.

### Estructura del repositorio

```
src/
├── app.js · server.js            configuración de Express · arranque y cierre ordenado
├── config/   env.js · database.js  variables de entorno validadas · conexión por entorno
├── controllers/                   auth · incidentes · salud (health, logs, métricas)
├── middleware/                    auth · forzarHttps · limiteLogin · logger · errorHandler · validar*
├── models/                        reglas puras · modelos Sequelize · permisos · catálogos
├── repositories/                  consultas a la base
├── routes/                        auth.routes · incidentes.routes
├── utils/                         AppError · asyncHandler · log (registro estructurado)
└── database/ migrations/ · seeders/
public/                            front-end (HTML, CSS, JS, imágenes)
scripts/                           crear-env · verificar-despliegue · guardar-evidencia · medir…
tests/                             unit/ · unit/frontend/ · integracion/
docs/                              este documento · manual · despliegue · defensa · reportes · evidencias
render.yaml                        Blueprint de Render (infraestructura como código)
```

---

## 2. Requisitos

| Elemento | Versión / nota |
|---|---|
| Node.js | ≥ 18.18 (el despliegue usa 20; ver `.nvmrc`) |
| npm | el que acompaña a Node |
| Base de datos local | SQLite (sin instalar nada) |
| Base de datos en producción | PostgreSQL (servicio gestionado) |
| Navegador | Chrome, Edge o Firefox actuales |

---

## 3. Instalación y ejecución local

```bash
npm install            # dependencias
npm run db:preparar    # crea .env desde .env.example, aplica migraciones y carga cuentas/datos de demostración
npm start              # http://localhost:3000
```

Cuentas de **demostración local** (solo si no se definió `SEED_*_PASSWORD`; en producción son obligatorias y distintas):

| Usuario | Rol | Contraseña local |
|---|---|---|
| `admin` | admin | `Admin-Demo-2026!` |
| `analista` | analista | `Analista-Demo-2026!` |
| `visor` | visor | `Visor-Demo-2026!` |

Reinicio completo de la base local: `npm run db:reset`.

---

## 4. Variables de entorno

Plantilla: `.env.example`. `.env` **nunca** se versiona (`.gitignore`). En producción las variables se cargan en el panel de Render.
Al arrancar, `src/config/env.js` valida todo y **detiene el proceso antes de aceptar tráfico** si falta algo; el mensaje nombra la variable, jamás su valor.

| Variable | Obligatoria | Ejemplo / valor por defecto | Descripción |
|---|---|---|---|
| `NODE_ENV` | sí en prod. | `production` | `development` · `test` · `production`. Cambia los valores por defecto de HTTPS, logs y CORS |
| `PORT` | no | lo asigna Render | Puerto de escucha (3000 por defecto) |
| `DATABASE_URL` | recomendada en nube | `postgres://usuario:clave@host:5432/bd` | Se descompone en `DB_*`; `?sslmode=require` activa TLS |
| `DB_DIALECT` | no | `sqlite` | `sqlite` · `mysql` · `postgres` (ignorada si hay `DATABASE_URL`) |
| `DB_STORAGE` | no | `database/incidentes.sqlite` | Solo SQLite |
| `DB_HOST` `DB_PORT` `DB_NAME` `DB_USER` `DB_PASSWORD` | si MySQL/PG sin URL | — | Conexión por variables sueltas |
| `DB_SSL` | no | `false` | `true` exige TLS con certificado válido |
| `JWT_SECRET` | **sí** | ≥ 32 caracteres aleatorios | Firma de tokens. En producción se rechaza el valor de ejemplo |
| `JWT_EXPIRA` | no | `8h` | Duración de la sesión |
| `CORS_ORIGIN` | no | vacío en producción | Orígenes externos permitidos (coma). En producción solo `https://` |
| `FORCE_HTTPS` | no | `true` en producción | Redirige HTTP → HTTPS |
| `TRUST_PROXY` | no | `1` en producción | Saltos de proxy de confianza (para detectar HTTPS y la IP real) |
| `LOG_FORMAT` | no | `json` en producción | `json` · `texto` |
| `LOGIN_MAX_INTENTOS` · `LOGIN_VENTANA_MIN` | no | `10` · `15` | Límite de intentos fallidos por IP |
| `SEED_ADMIN_PASSWORD` · `SEED_ANALISTA_PASSWORD` · `SEED_VISOR_PASSWORD` | **sí en prod.** | ≥ 10 caracteres | Claves de las cuentas iniciales |

**Rotación de un secreto:** cambiar el valor en el panel → Render redespliega → los tokens firmados con el secreto anterior dejan de valer (los usuarios inician sesión de nuevo).

---

## 5. Base de datos

La estructura la crean **migraciones** (`src/database/migrations`), nunca `sync()`:

| # | Migración | Contenido |
|---|---|---|
| 1 | `20260925000001-crear-tabla-incidentes` | Tabla `incidentes` + índices por estado, severidad y fecha |
| 2 | `20261001000002-agregar-prioridad-incidentes` | Columna `prioridad` + índices simple y compuesto (estado, prioridad) |
| 3 | `20261010000003-crear-tabla-usuarios` | Tabla `usuarios` (hash bcrypt, rol, activo) |

Seeders (registrados en `SequelizeData`, se ejecutan **una sola vez**): cuentas iniciales y 6 incidentes ficticios.
Esquema documentado: `docs/esquema/schema.sql`. Catálogos: severidad `baja|media|alta|critica`, prioridad `baja|media|alta|urgente`, estado `abierto|en_progreso|resuelto|cerrado`, categoría `phishing|malware|acceso_no_autorizado|ddos|fuga_de_datos|otro`.

**Persistencia:** en Render el disco del servicio web es efímero; por eso producción usa PostgreSQL gestionado. SQLite en producción genera una advertencia en el log al arrancar.

---

## 6. API

Base: `https://<su-servicio>.onrender.com/api`. Formato de error único: `{ "ok": false, "error": { "mensaje", "estado", "detalles?", "referencia?" } }`.

| Método | Ruta | Rol mínimo | OK | Errores típicos |
|---|---|---|---|---|
| POST | `/auth/login` | — | 200 | 400 datos inválidos · 401 credenciales · 429 demasiados intentos |
| GET | `/auth/me` | cualquiera | 200 | 401 |
| GET | `/health` | — | 200 | **503** si la base no responde |
| GET | `/incidentes` | visor | 200 | 400 filtro inválido · 401 |
| GET | `/incidentes/:id` | visor | 200 | 400 id · 404 |
| GET | `/incidentes/stats` · `/catalogos` | visor | 200 | 401 |
| POST | `/incidentes` | analista | 201 | 400 validación · 403 |
| PUT · PATCH | `/incidentes/:id` | analista | 200 | 400 · 403 · 404 |
| DELETE | `/incidentes/:id` | admin | 204 | 403 · 404 |
| GET | `/logs` | admin | 200 | 403 |
| GET | `/metricas` | admin | 200 | 403 |

Listado: filtros `estado, prioridad, severidad, categoria, q`; paginación `pagina, limite` (máx. 100); orden `orden, dir`.
Ejemplos listos para usar en `docs/pruebas.http` (extensión REST Client de VS Code).

---

## 7. Seguridad

| Control | Implementación | Dónde se prueba |
|---|---|---|
| Autenticación | JWT HS256 con expiración y emisor; la cuenta se reconsulta en cada petición (si se desactiva, el token deja de servir) | `seguridad.test.js` |
| Contraseñas | Hash bcrypt; el hash nunca sale en una respuesta (`toJSON`); mismo mensaje para usuario inexistente y clave incorrecta; comparación con hash de relleno (tiempo parejo) | `seguridad.test.js` |
| Autorización | Matriz en `models/permisos.js` aplicada **en el servidor** (el front solo oculta botones). Denegar por defecto | `permisos.test.js`, `seguridad.test.js` |
| Validación | Dos capas: reglas puras en middleware + validaciones del modelo Sequelize. Lista blanca de campos (bloquea asignación masiva) | `incidente.reglas.test.js`, `incidentes.test.js` |
| Inyección SQL | Consultas parametrizadas por el ORM; el único `literal` (búsqueda, orden) se construye con valores escapados o constantes del catálogo | `seguridad.test.js` (caso 15) |
| XSS | El front escapa todo texto con `esc()`; CSP de Helmet | `componentes.test.js` |
| HTTPS | Redirección 308 para GET/HEAD, 403 para otros métodos por HTTP; HSTS y `upgrade-insecure-requests` (Helmet) | `produccion.test.js` |
| CORS | Lista blanca por origen; en producción vacía y solo `https://` | `seguridad.test.js` (caso 16) |
| Fuerza bruta | Máx. 10 intentos fallidos por IP / 15 min → 429 + `Retry-After` | `limiteLogin.test.js` |
| Cabeceras | Helmet; sin `X-Powered-By`; cuerpo máx. 10 kB | `incidentes.test.js` |
| Errores | Los 5xx devuelven solo una `referencia`; el detalle queda en el log del servidor | `incidentes.test.js`, `produccion.test.js` |
| Secretos | Solo en variables de entorno; `.env` fuera del repositorio; el log redacta campos con nombre sensible | `env.test.js`, `produccion.test.js` |

---

## 8. Monitoreo y logs

- **Log estructurado** (una línea JSON por evento a stdout; Render lo muestra en *Logs*):
  `{"ts":"…","nivel":"info","mensaje":"solicitud","requestId":"…","metodo":"GET","url":"/api/incidentes","estado":200,"duracionMs":12.4,"ip":"…","usuarioId":2,"rol":"analista"}`
  Nivel: 5xx → `error`, 4xx → `warn`, resto → `info`. **No** se guardan cabeceras, cuerpos, contraseñas, tokens ni parámetros de consulta (un texto de búsqueda puede ser sensible).
- **Trazabilidad:** cada respuesta incluye `X-Request-Id`; en un error 5xx el cliente recibe ese mismo valor como `referencia`. Buscar la referencia en los logs de Render localiza el evento exacto.
- **Health check:** `GET /api/health` → 200 con `version`, `commit`, `entorno`, estado de la base; 503 si la base no responde. Render lo usa (`healthCheckPath`) para decidir si una instancia recibe tráfico.
- **Métricas** (admin): `GET /api/metricas` → solicitudes por clase (2xx/3xx/4xx/5xx), disponibilidad %, latencia promedio y **p95** de las últimas 500 peticiones. Sirve como el panel de la guía (disponibilidad · errores 5xx · p95).
- **Umbrales y respuesta sugerida:** 5xx > 1 % o p95 > 1 000 ms sostenido → revisar logs por `nivel:error`, identificar el `requestId`, decidir corrección o reversión (sección 10).
- **Límite:** las métricas y el registro de peticiones están en memoria (se reinician con cada despliegue); los logs completos los conserva Render con su retención del plan.

---

## 9. Pruebas

| Capa | Comando | Qué cubre |
|---|---|---|
| Unitarias | `npm run test:unit` | Reglas de negocio, permisos, configuración de entorno (`env.test.js`), límite de login, componentes del front |
| Integración | `npm run test:integracion` | API completa con SQLite en memoria y **las mismas migraciones**: CRUD, roles, validación, errores, seguridad, regresiones, salud, trazabilidad, logs, métricas, HTTPS |
| Cobertura | `npm run test:cobertura` | Umbral ≥ 90 % en reglas de negocio y 100 % en permisos |
| Análisis estático | `npm run lint` | ESLint con métricas de complejidad |
| **Producción** | `npm run verificar -- https://<servicio>` | Recorrido real contra la URL desplegada (ver `docs/DESPLIEGUE.md` §6) |
| Todo y evidencia | `npm run evidencia` | Pruebas + ESLint → `docs/reportes/pruebas-actual.txt`, `eslint-actual.txt` |

Casos fallidos cubiertos: credenciales inválidas, token ausente o alterado, rol insuficiente, datos incorrectos, registro inexistente, JSON mal formado, base caída (503), demasiados intentos (429), HTTP sin cifrar.

---

## 10. Despliegue, reversión y mantenimiento

El procedimiento paso a paso está en **`docs/DESPLIEGUE.md`** (GitHub → Render Blueprint → variables → verificación).
Resumen del canal: `código → pruebas → build (npm install) → migraciones + seed → health check → producción`.

**Trazabilidad:** cada despliegue corresponde a un commit y una etiqueta (`v4.0.0`); `/api/health` expone `version` y `commit`, de modo que la URL, el repositorio y las capturas se pueden relacionar con una versión concreta.

**Reversión:** Render conserva los despliegues anteriores (*Events → Rollback* al último estable). El código vuelve atrás de inmediato; **los datos no**. Por eso las migraciones son reversibles (`npm run db:migrate:undo`) pero un cambio de esquema destructivo requiere respaldo previo (sección 11).

**Mantenimiento:** actualizar dependencias con `npm audit` y `npm update` (siempre con las pruebas en verde); rotar `JWT_SECRET` y las claves de las cuentas tras la evaluación; eliminar o desactivar cuentas y datos de demostración.

---

## 11. Respaldo y recuperación

- Base PostgreSQL de Render: exportar con `pg_dump "$DATABASE_URL" > respaldo.sql` (desde una máquina con acceso a la URL externa) antes de cualquier migración destructiva y antes de la defensa. Restaurar con `psql "$DATABASE_URL" < respaldo.sql`.
- Los incidentes de demostración se recrean con `npm run db:reset` (solo local).
- Si el servicio no inicia durante la defensa: ver plan de contingencia en `docs/DEFENSA.md`.

---

## 12. Limitaciones conocidas y mejoras

| Limitación | Impacto | Mejora propuesta |
|---|---|---|
| Plan gratuito: el servicio se duerme tras inactividad y la primera petición tarda | Primera carga lenta en la defensa | Abrir `/api/health` antes; plan de pago o monitor de disponibilidad externo |
| Plan gratuito de base de datos con vigencia limitada | La base puede expirar | Respaldo periódico; plan de pago o proveedor con plan permanente |
| Límite de login y métricas **en memoria** | Se pierden al reiniciar; con varias instancias no se comparten | Redis o tabla de intentos; Prometheus/Grafana |
| Token JWT sin revocación inmediata ni *refresh token* | Una sesión robada sirve hasta expirar (8 h) | Tokens cortos + refresh con rotación; lista de revocación |
| Token guardado en `sessionStorage` | Un XSS podría leerlo | Cookie `HttpOnly; Secure; SameSite` + protección CSRF |
| Sin registro de auditoría de cambios por usuario | No se sabe quién editó qué | Tabla de auditoría (quién, qué, cuándo) |
| Sin alertas automáticas | Los fallos se detectan al revisar | Monitor externo (UptimeRobot/Better Stack) sobre `/api/health` con aviso por correo |
| Sin recuperación de contraseña ni gestión de usuarios desde la UI | Altas por seeder o base | CRUD de usuarios solo admin, 2FA para admin |
| Solución académica | No lista para datos institucionales reales | Revisión de seguridad independiente, política de retención, acuerdos de servicio y respaldos probados |
