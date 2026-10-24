# Historial de versiones

## 4.0.0 — Reto 4: integración, despliegue y defensa
Etiqueta de Git: `v4.0.0` (la versión que se evalúa; si cambia durante la evaluación se registra aquí el motivo).

**Añadido**
- Migraciones (`src/database/migrations`) y seeders (`src/database/seeders`) incluidos en el repositorio; tabla `usuarios` en su propia migración.
- Configuración por entorno completa: `DATABASE_URL`, `TRUST_PROXY`, `FORCE_HTTPS`, `LOG_FORMAT`, límites de login. Validación al arrancar con mensajes que nombran la variable, nunca su valor.
- HTTPS obligatorio en producción (redirección 308, HSTS, `upgrade-insecure-requests`).
- Logs estructurados (JSON) con `X-Request-Id`, nivel por código de estado y sin cabeceras, cuerpos ni parámetros de búsqueda.
- `/api/health` con versión, commit y entorno; responde 503 si la base no contesta. `/api/metricas` (admin): disponibilidad, 5xx y latencia p95.
- Límite de intentos fallidos de login (429 + `Retry-After`).
- Soporte PostgreSQL (`pg`, `pg-hstore`); la búsqueda de texto es insensible a mayúsculas en SQLite, MySQL y PostgreSQL.
- `render.yaml` (Blueprint), `scripts/verificar-despliegue.js` (pruebas en producción) y documentación técnica, manual de usuario y guion de defensa.

**Cambiado**
- `sequelize-cli` pasó a `dependencies` (se necesita en producción para migrar).
- Los errores 5xx devuelven como `referencia` el mismo id de la cabecera `X-Request-Id`.
- En producción no se instalan dependencias al arrancar y CORS no admite ningún origen salvo que se declare (solo `https://`).

## 3.1.0 — Reto 3 (Unidad 7)
Pruebas con Jest, ESLint, refactorización MVC, optimización y defectos corregidos con DevTools. Ver README.
