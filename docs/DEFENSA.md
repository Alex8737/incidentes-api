# Guion de defensa — Reto 4 (≈ 12–15 min + preguntas)

**Mensaje central:** *«Una plataforma que registra incidentes de seguridad y que, además, se protege a sí misma: solo entra quien debe, hace lo que su rol permite, deja rastro sin exponer secretos y puedo demostrarlo con pruebas.»*

## 1. Estructura de la exposición

| Min | Bloque | Qué se dice / hace | Evidencia a la vista |
|---|---|---|---|
| 0–2 | **Problema y usuario** | Los equipos de seguridad pierden incidentes en correos y hojas sueltas; no hay clasificación ni seguimiento. Tres usuarios: analista (registra), administrador (decide y elimina), auditor (solo lee) | Diapositivas 2–3 |
| 2–4 | **Arquitectura** | Navegador → servicio Node/Express (API + front) → PostgreSQL; logs a Render. Por qué un solo servicio (sin CORS, una URL, una versión) | Diagrama (diap. 4) |
| 4–9 | **Demostración en vivo** (recorrido preparado) | 1) Abrir la URL: candado HTTPS y `/api/health`. 2) Login **visor**: ve la lista, no ve Editar/Eliminar; probar desde la consola un POST → 403 (la API protege, no solo la interfaz). 3) Login **analista**: crear un incidente con un dato inválido (error claro) y luego uno válido. 4) Consultar/filtrar/buscar. 5) Cambiar estado a «en progreso». 6) Login **admin**: eliminar. 7) Reiniciar el servicio y comprobar que los datos persisten | URL, Render *Events* |
| 9–11 | **Seguridad y operación** | JWT + bcrypt, matriz de roles en el servidor, validación en 2 capas, HTTPS forzado + HSTS, límite de intentos, logs sin secretos con `X-Request-Id`. Mostrar un error 5xx simulado y cómo la «referencia» localiza el evento en los logs. Mostrar `/api/metricas` | Logs de Render, métricas |
| 11–13 | **Pruebas y resultados** | N pruebas Jest (unitarias + integración con las mismas migraciones), ESLint, cobertura; `npm run verificar` contra producción: todas las comprobaciones OK | `docs/reportes/`, `docs/evidencias/verificacion-produccion-*.txt` |
| 13–15 | **Limitaciones y mejoras / lecciones** | Ver §4 y §5 | Diap. 10–11 |

> Regla de oro: **las diapositivas apoyan; la demostración y la argumentación son lo evaluado.** Cada paso de la demo se relaciona con un requisito (CRUD, autenticación, autorización, validación, HTTPS, logs, health, persistencia).

## 2. Mapa requisito → evidencia (para señalar rápido)

| Requisito del Reto 4 | Dónde se ve |
|---|---|
| CRUD persistente | Demo pasos 3–7; `produccion.test.js` (persistencia); `verificar-despliegue.js` (ciclo completo) |
| Autenticación | Login; `seguridad.test.js`; token firmado con vencimiento |
| Autorización | Visor/analista/admin en vivo; matriz `permisos.js`; 403 desde consola |
| Validación | Error del formulario; `incidente.reglas.test.js`; 400 con detalles |
| HTTPS | Candado; redirección 308; HSTS en cabeceras; `produccion.test.js` |
| Configuración por entorno | Panel *Environment* (solo nombres); `env.test.js`; arranque falla sin `JWT_SECRET` |
| Logs | Panel de logs de Render (JSON, `requestId`, sin cabeceras ni contraseñas) |
| Health check | `/api/health` (200/503); `healthCheckPath` en Render |
| Pruebas finales | Reportes de Jest/ESLint + verificación en producción |
| Documentación | `README`, `DOCUMENTACION_TECNICA`, `MANUAL_USUARIO`, `DESPLIEGUE` |

## 3. Preguntas probables y respuestas modelo

**Arquitectura**
- *¿Por qué un solo servicio y no front en Vercel + API en Render?* — Evita CORS y dos despliegues desalineados; una URL y una versión. Si el front necesitara CDN o escalado independiente, lo separaría y configuraría `CORS_ORIGIN` con `https://` explícito.
- *¿Por qué PostgreSQL y no SQLite en la nube?* — El disco del servicio web es efímero: cada despliegue borraría los datos. SQLite se mantiene para desarrollo y pruebas (rápido, sin instalar); el ORM permite cambiar de motor por variables.
- *¿Por qué migraciones y no `sync()`?* — Versionan el esquema, son reversibles y reproducibles en cualquier entorno; las pruebas usan las mismas.
- *¿Qué patrón usa?* — MVC: reglas puras en el modelo (se prueban sin servidor), controladores delgados, repositorio para consultas, vista en el front.

**Seguridad**
- *¿Dónde se guarda la contraseña?* — Solo el hash bcrypt; nunca sale en una respuesta ni en un log. El login responde igual si el usuario no existe o la clave falla.
- *Si oculto el botón «Eliminar», ¿alguien puede eliminar?* — No: la API rechaza con 403 por rol; el botón oculto es solo comodidad. Lo demuestro con un POST manual del visor.
- *¿Qué pasa si roban el token?* — Sirve hasta expirar (8 h). Mitigación hoy: expiración, HTTPS, CSP/escape contra XSS. Mejora: tokens cortos con *refresh* y cookie `HttpOnly`.
- *¿Cómo evita fuerza bruta?* — 10 intentos fallidos por IP en 15 min → 429 con `Retry-After`. Limitación: está en memoria; con varias instancias iría en Redis.
- *¿Qué hace con las variables secretas?* — Solo en el panel del proveedor; el log y los errores nombran la variable, no su valor; `.env` está en `.gitignore`. Rotación: cambiar el valor y redesplegar (invalida tokens antiguos).
- *¿Inyección SQL / XSS?* — Consultas parametrizadas (ORM); el único SQL literal se construye con valores escapados o constantes de catálogo; hay pruebas del caso `' OR '1'='1`. En el front todo texto se escapa; hubo un XSS real en Reto 3 (filtro de búsqueda) con prueba de regresión.

**Pruebas**
- *¿Qué prueban y qué no?* — Reglas, permisos, API completa con la base real de migraciones (casos correctos y fallidos), configuración y HTTPS. No prueban rendimiento bajo carga ni el navegador real de extremo a extremo (mejora: Playwright).
- *¿La ruta de salud basta?* — No: puede dar 200 con el login roto. Por eso `verificar-despliegue.js` recorre login, CRUD y roles en producción.
- *¿Cómo sabe que lo probado es lo desplegado?* — `/api/health` expone `version` y `commit`; el reporte de verificación los registra.

**Despliegue / operación**
- *¿Y si la versión nueva falla?* — Rollback al despliegue estable en Render (código inmediato); los datos requieren respaldo previo (`pg_dump`) porque revertir código no revierte esquema.
- *¿Cómo detecta errores?* — Logs JSON por nivel, `X-Request-Id` ↔ «referencia» del error, `/api/metricas` (5xx, p95) y health check del balanceador. Falta alertado externo.
- *¿Está lista para datos reales?* — No: es una solución académica. Faltan auditoría de cambios, gestión de usuarios, 2FA, respaldos probados, plan de pago/SLA, revisión de seguridad independiente y política de retención.

## 4. Limitaciones que se declaran (sin ocultarlas)

Plan gratuito con reposo y vigencia limitada de la base · límite de login y métricas en memoria · JWT sin revocación inmediata ni *refresh* · token en `sessionStorage` · sin auditoría por usuario · sin alertas automáticas · sin pruebas E2E de navegador ni de carga · sin gestión de usuarios en la interfaz. Detalle y mejoras: `docs/DOCUMENTACION_TECNICA.md` §12.

## 5. Lecciones aprendidas (con ejemplos del proyecto)

| Qué pasó | Qué se aprendió | Acción concreta |
|---|---|---|
| En Reto 3 la búsqueda con `_` y `%` devolvía 0 resultados (SQLite no usa `\` como escape en `LIKE`) | Los defectos de datos aparecen con casos límite; una prueba de regresión los fija | Prueba en `regresion.test.js`; en Reto 4 la búsqueda además se hizo insensible a mayúsculas también en PostgreSQL (`LOWER`) |
| Lo que funciona en SQLite puede fallar en PostgreSQL (mayúsculas en `LIKE`, ephemeral disk) | Probar en el motor de producción | Se documentó el motor por entorno y se usa PostgreSQL en la nube |
| Un secreto de ejemplo en `.env.example` puede llegar a producción | La configuración debe fallar con claridad | `env.js` rechaza el secreto de ejemplo y orígenes no `https://` en producción |
| El front decía «¿Ejecutaste npm start?» ante un fallo | Los mensajes de desarrollo no sirven al usuario final | Mensaje neutral de conexión |
| La ruta de salud no detecta un login roto | Salud ≠ pruebas funcionales | Script de verificación contra producción |

**Siguiente iteración (priorizada por impacto/esfuerzo):** alerta externa sobre `/api/health` (alto/bajo) → auditoría de cambios (alto/medio) → *refresh token* + cookie `HttpOnly` (alto/medio) → pruebas E2E con Playwright (medio/medio) → gestión de usuarios y 2FA admin (medio/alto).

## 6. Plan de contingencia (si algo falla en vivo)

| Falla | Respuesta |
|---|---|
| El servicio está dormido / tarda | Abrir `/api/health` 2 min antes; mientras carga, explicar la arquitectura |
| 503 o la base no responde | Mostrar el log de Render (diagnóstico sin ocultarlo), explicar el plan de reversión y pasar a la ejecución local (`npm start`) con la misma versión (`git checkout v4.0.0`) |
| Sin Internet | Ejecución local + video corto grabado del flujo completo en producción (grabar antes: login → crear → editar → eliminar → logs) |
| Contraseña olvidada | Gestor de contraseñas; si no, redefinir `SEED_*` y recrear (documentado) o usar cuentas locales |
| Pregunta sin respuesta | Reconocer el límite, relacionarlo con la mejora propuesta (§4) |

## 7. Reparto sugerido (si es en pareja)

Cada integrante debe poder explicar **todo el flujo**: uno conduce la demo y la arquitectura; el otro seguridad, pruebas y limitaciones, y se intercambian en las preguntas.
