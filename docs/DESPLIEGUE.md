# Guía de despliegue en Render — paso a paso (v4.0.0)

Resultado esperado: una **URL pública con HTTPS** (`https://incidentes-api-xxxx.onrender.com`) con la plataforma completa y persistente.
Tiempo estimado: 30–40 minutos. Necesita cuentas gratuitas de **GitHub** y **Render**.

## 1. Subir el código a GitHub (repositorio versionado)

En la carpeta del proyecto (terminal de VS Code):

```bash
git init -b main
git add .
git status                      # compruebe que NO aparecen .env, node_modules ni *.sqlite
git commit -m "Reto 4: plataforma de incidentes lista para despliegue (v4.0.0)"
git remote add origin https://github.com/<su-usuario>/incidentes-api.git   # repositorio vacío creado en github.com
git push -u origin main
git tag -a v4.0.0 -m "Versión entregada en el Reto 4"
git push origin v4.0.0
```

> Importante: `npm install` actualiza `package-lock.json` con `pg`, `pg-hstore` y `sequelize-cli`; haga el commit **después** de instalar.

## 2. Crear los servicios en Render (Blueprint)

1. Entre a <https://dashboard.render.com> → **New** → **Blueprint**.
2. Conecte su cuenta de GitHub y elija el repositorio. Render lee `render.yaml` y propone: la base **incidentes-db** (PostgreSQL) y el servicio web **incidentes-api**.
3. Render pide los valores marcados `sync: false`. Escriba **contraseñas fuertes y distintas** (mínimo 10 caracteres) y anótelas en un gestor de contraseñas:
   - `SEED_ADMIN_PASSWORD`
   - `SEED_ANALISTA_PASSWORD`
   - `SEED_VISOR_PASSWORD`
4. **Apply**. Render ejecuta `npm install`, luego `npm run start:prod` (migra, carga las cuentas una vez y arranca) y consulta `/api/health`.

`JWT_SECRET` lo genera Render; `DATABASE_URL` se enlaza solo con la base.

### Alternativa manual (sin Blueprint)
*New → PostgreSQL* (copie la **Internal Database URL**) · *New → Web Service* → repositorio →
Build: `npm install` · Start: `npm run start:prod` · Health check path: `/api/health` ·
variables: `NODE_ENV=production`, `NODE_VERSION=20`, `DATABASE_URL`, `JWT_SECRET` (≥ 32 caracteres aleatorios), `SEED_*_PASSWORD`.

## 3. Comprobaciones inmediatas

```text
https://<su-servicio>.onrender.com/api/health   →  {"ok":true,"version":"4.0.0",...,"baseDeDatos":{"motor":"postgres","conectada":true}}
https://<su-servicio>.onrender.com/             →  pantalla de inicio de sesión
http://<su-servicio>.onrender.com/              →  redirige a https://
```

En *Logs* de Render debe verse (sin contraseñas) el evento `servicio iniciado` con `"baseDeDatos":"postgres"` y `"httpsForzado":true`.
Si el servicio falla al iniciar, el log nombra la variable que falta (nunca su valor).

## 4. Variables configuradas (evidencia sin valores)

Capture *Environment* en Render **ocultando los valores** (basta que se vean los nombres): `NODE_ENV`, `NODE_VERSION`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRA`, `SEED_ADMIN_PASSWORD`, `SEED_ANALISTA_PASSWORD`, `SEED_VISOR_PASSWORD`.

## 5. Despliegue continuo y control de versiones

`autoDeploy: true` publica cada *push* a `main`. Para no romper la URL de evaluación:

1. Trabaje en una rama (`git switch -c mejora-x`), ejecute `npm test` y `npm run lint`.
2. Abra un *pull request* a `main` y fusione solo con pruebas en verde.
3. Tras fusionar, Render despliega; revise *Logs* y `/api/health` (ventana de observación de 10–15 min: errores 5xx y tiempos en `/api/metricas`).
4. **Congele la versión de entrega:** una vez evaluada, no cambie `main` sin registrar el motivo en `CHANGELOG.md`.

## 6. Pruebas en producción (evidencia)

Desde su PC, con las cuentas creadas en el paso 2 (los valores **no** se imprimen ni se guardan):

**PowerShell**
```powershell
$env:VERIF_ADMIN_USER="admin";  $env:VERIF_ADMIN_PASSWORD="<clave admin>"
$env:VERIF_VISOR_USER="visor";  $env:VERIF_VISOR_PASSWORD="<clave visor>"
npm run verificar -- https://<su-servicio>.onrender.com
```
**Bash**
```bash
VERIF_ADMIN_USER=admin VERIF_ADMIN_PASSWORD='<clave admin>' VERIF_VISOR_USER=visor VERIF_VISOR_PASSWORD='<clave visor>' \
  npm run verificar -- https://<su-servicio>.onrender.com
```

Comprueba HTTPS, salud, cabeceras, 401/403/400/404, CRUD completo (crea → lee → busca → actualiza → elimina el registro de prueba), asignación masiva, autorización del visor, logs sin secretos y métricas.
Genera `docs/evidencias/verificacion-produccion-<fecha>.txt` (versión y commit incluidos). Añádalo al repositorio.

**Recorrido manual** (con capturas, ver `docs/evidencias/REGISTRO_PRUEBAS_PRODUCCION.md`): login → crear → consultar → editar → cambiar estado → eliminar (admin) → cerrar sesión → verificar que el visor no ve «Editar/Eliminar».

**Persistencia:** cree un incidente → en Render use *Manual Deploy → Restart service* → inicie sesión y confirme que el incidente sigue ahí.

## 7. Plan de reversión

1. Identifique la última versión estable (etiqueta `v…` o despliegue anterior con `/api/health` en 200).
2. Render → servicio → **Events** → despliegue estable → **Rollback**. (Desactiva el auto-despliegue hasta corregir.)
3. Si cambió el esquema: **antes** de migrar, `pg_dump` de la base; revierta con `npm run db:migrate:undo` solo si la migración es reversible y no destruye datos.
4. Corrija en una rama, pruebe, fusione y vuelva a activar el auto-despliegue.

## 8. Antes de la defensa (checklist)

- [ ] `/api/health` responde 200 (el plan gratuito se duerme: ábralo 2 minutos antes y espere el primer 200).
- [ ] Las tres cuentas funcionan; contraseñas a mano (no en pantalla compartida).
- [ ] `npm run verificar` pasó y su evidencia está en el repositorio.
- [ ] Hay incidentes de demostración comprensibles, sin información real.
- [ ] Capturas de la versión entregada (Render *Events*, *Logs*, *Environment* sin valores).
- [ ] Plan de contingencia listo: `docs/DEFENSA.md` §6 (video corto del flujo y ejecución local con `npm start`).
- [ ] `pg_dump` reciente guardado fuera del repositorio.

## 9. Después de la evaluación

Rotar `JWT_SECRET` y las tres contraseñas, borrar los datos de demostración (o suspender el servicio) y dejar anotado en `CHANGELOG.md` el estado final.

## 10. Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| El despliegue falla con `Falta JWT_SECRET` o `Faltan variables…` | Variable ausente o corta | Defínala en *Environment*; el log solo nombra la variable |
| `Falta SEED_ADMIN_PASSWORD` al iniciar | Las claves de las cuentas son obligatorias en producción | Agregue las tres `SEED_*_PASSWORD` |
| `CORS_ORIGIN solo admite orígenes https://` | Valor con `http://` | Déjela vacía (mismo dominio) o use `https://` |
| 503 en `/api/health` | La base no responde (suspendida/expirada) | Revise el estado de la base en Render; restaure desde respaldo |
| Bucle de redirecciones | `TRUST_PROXY` en `false` detrás del proxy | Use `TRUST_PROXY=1` (valor por defecto en producción) |
| Los datos desaparecen al redesplegar | Se está usando SQLite en producción | Defina `DATABASE_URL` (PostgreSQL) |
| Primera carga muy lenta | Plan gratuito dormido | Abra `/api/health` unos minutos antes |
