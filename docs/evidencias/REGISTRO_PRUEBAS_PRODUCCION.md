# Registro de pruebas en producción

**Plataforma:** Gestión de Incidentes · **Versión:** 4.0.0 · **Etiqueta:** `v4.0.0`
**URL:** `https://________.onrender.com` · **Commit (de /api/health):** `_______` · **Fecha:** __/__/2026 · **Responsable:** Alex Logacho

> Cuentas y datos creados solo para esta prueba. No se eliminaron registros reales ni se ejecutó carga agresiva.
> Complete la tabla durante la prueba; la evidencia automática la genera `npm run verificar -- <URL>` en esta misma carpeta.

| ID | Prueba | Pasos | Resultado esperado | Resultado obtenido | Evidencia |
|---|---|---|---|---|---|
| PP-01 | HTTPS activo | Abrir la URL con `http://` | Redirige a `https://`; candado visible | | captura candado |
| PP-02 | Health check | `GET /api/health` | 200, `ok:true`, base `postgres` conectada, versión 4.0.0 | | captura / JSON |
| PP-03 | Carga inicial | Abrir `/` en ventana privada | Aparece el login; sin errores en consola | | captura |
| PP-04 | Login válido (admin) | Usuario y clave correctos | Entra; muestra nombre y rol | | captura |
| PP-05 | Login inválido | Clave incorrecta | Mensaje genérico «Usuario o contraseña incorrectos» | | captura |
| PP-06 | Crear | Formulario válido | Incidente creado y listado | | captura |
| PP-07 | Validación | Título de 2 letras | Error claro; no se crea | | captura |
| PP-08 | Consultar y buscar | Buscar por texto y filtrar por estado | Resultados correctos; contador coincide | | captura |
| PP-09 | Actualizar | Cambiar estado a «en progreso» y editar | Cambios guardados | | captura |
| PP-10 | Rol visor | Entrar como visor; probar `POST` desde consola | Sin botones de edición; API responde 403 | | captura consola |
| PP-11 | Eliminar (admin) | Eliminar el incidente de prueba | Desaparece; GET posterior → 404 | | captura |
| PP-12 | Token ausente/ inválido | `GET /api/incidentes` sin token | 401 | | `verificacion-produccion-*.txt` |
| PP-13 | Persistencia | Crear incidente → *Restart service* en Render → volver a entrar | El incidente sigue | | captura Events + lista |
| PP-14 | Logs sin secretos | Revisar *Logs* en Render tras PP-04 a PP-11 | Eventos JSON con `requestId`; sin contraseñas, tokens ni cabeceras | | captura logs |
| PP-15 | Trazabilidad de error | Provocar 404/400 y buscar su `X-Request-Id` en logs | Se localiza el evento | | captura |
| PP-16 | Variables sin valores | Captura de *Environment* ocultando valores | Se ven solo los nombres | | captura |
| PP-17 | Móvil y teclado | Pantalla estrecha (DevTools) y navegación con Tab | Se usa sin desbordes; foco visible | | captura |
| PP-18 | Verificación automática | `npm run verificar -- <URL>` | Todas las comprobaciones pasan | | archivo `.txt` |
| PP-19 | Métricas | `GET /api/metricas` como admin | Disponibilidad, 5xx y p95 visibles | | captura |

**Fallos encontrados y corrección** (si los hubo): descripción → corrección en código → pruebas verdes → nuevo despliegue → nueva evidencia.
