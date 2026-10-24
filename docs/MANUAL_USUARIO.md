# Manual de usuario — Plataforma de Gestión de Incidentes

**Versión 4.0.0 · 24/10/2026** · Para personas que registran y siguen incidentes de seguridad informática.
Las capturas de pantalla corresponden a la versión entregada (carpeta `docs/capturas/`).

---

## 1. ¿Para qué sirve?

Permite **registrar** un incidente de seguridad (por ejemplo, un correo de phishing), **clasificarlo** por categoría, severidad y prioridad, **darle seguimiento** cambiando su estado y **consultar** el historial con filtros y búsqueda.

## 2. Roles: qué puede hacer cada persona

| Acción | Visor (auditoría) | Analista | Administrador |
|---|:---:|:---:|:---:|
| Ver incidentes, estadísticas y filtros | ✔ | ✔ | ✔ |
| Crear incidentes | — | ✔ | ✔ |
| Editar y cambiar el estado | — | ✔ | ✔ |
| Eliminar incidentes | — | — | ✔ |
| Ver registro de actividad (logs) | — | — | ✔ |

Su rol lo asigna la administración junto con su usuario y contraseña. La pantalla solo muestra los botones que su rol permite.

## 3. Acceso

1. Abra la dirección de la plataforma (`https://…onrender.com`). Debe aparecer el candado del navegador (conexión cifrada).
2. Escriba su **usuario** y **contraseña** y pulse **Entrar**.
3. Arriba a la derecha verá su nombre y rol. Al terminar, pulse **Cerrar sesión**; la sesión también se cierra sola a las 8 horas.

📷 `docs/capturas/manual-01-login.png`

**Mensajes que puede ver**

| Mensaje | Qué significa | Qué hacer |
|---|---|---|
| «Usuario o contraseña incorrectos» | Datos equivocados | Revise mayúsculas y vuelva a intentar |
| «Demasiados intentos fallidos. Intente de nuevo más tarde.» | Se superó el límite de intentos (10 en 15 min) | Espere unos minutos o pida ayuda al administrador |
| «Sesión no válida o expirada. Inicie sesión de nuevo» | Su sesión terminó | Entre otra vez |

## 4. Pantalla principal

- **Resumen** (arriba): Total, Abiertos, En progreso, Resueltos (incluye los cerrados), Críticos y Urgentes.
- **Formulario** (izquierda): crear o editar un incidente.
- **Lista** (derecha): incidentes con sus etiquetas de color, filtros y paginación. El número junto a «Incidentes» es el total que cumple los filtros.
- El indicador de estado (junto a su nombre) confirma que la plataforma está conectada.

📷 `docs/capturas/manual-02-pantalla-principal.png`

## 5. Crear un incidente (analista o administrador)

1. En el formulario **Nuevo incidente** complete:
   - **Título** (obligatorio, 5 a 120 caracteres): ej. «Acceso sospechoso al servidor».
   - **Descripción**: qué ocurrió (hasta 2000 caracteres).
   - **Categoría**: phishing, malware, acceso no autorizado, DDoS, fuga de datos u otro.
   - **Severidad** (obligatoria): el impacto técnico — baja, media, alta o crítica.
   - **Prioridad**: la urgencia de atención — baja, media, alta o urgente.
   - **Estado**: abierto (por defecto), en progreso, resuelto o cerrado.
   - **Reportado por**: persona o área que avisó.
2. Pulse **Crear incidente**. Verá el aviso de confirmación y el incidente aparecerá en la lista.

📷 `docs/capturas/manual-03-crear.png`

**Si el formulario marca un error:** el mensaje indica el campo (por ejemplo «El título debe tener entre 5 y 120 caracteres»). Corrija y vuelva a pulsar el botón.

## 6. Consultar y buscar

- **Buscar:** escriba una palabra del título o de la descripción (no distingue mayúsculas; los símbolos `%` y `_` se buscan tal cual).
- **Filtrar:** elija estado, prioridad, severidad o categoría; los filtros se pueden combinar.
- **Paginación:** use los controles bajo la lista para ver más resultados.
- Para ver todo de nuevo, borre la búsqueda y deje los filtros en «Todos».

📷 `docs/capturas/manual-04-filtros.png`

## 7. Actualizar el estado y editar (analista o administrador)

- **Cambiar el estado rápido:** en la tarjeta del incidente, use el selector «Cambiar estado» (abierto → en progreso → resuelto → cerrado).
- **Editar:** pulse **Editar**; los datos pasan al formulario. Modifique y pulse **Guardar cambios** (o **Cancelar** para salir sin cambios).

📷 `docs/capturas/manual-05-editar.png`

## 8. Eliminar un incidente (solo administrador)

Pulse **Eliminar** en la tarjeta y confirme en el cuadro «¿Eliminar el incidente #…?». **La acción no se puede deshacer.**

## 9. Cómo identificar el cierre de un incidente

Un incidente pasa a **resuelto** cuando el problema se corrigió y a **cerrado** cuando ya fue revisado y no requiere más acciones. Use «Cerrado» para mantener el historial sin borrarlo.

## 10. Solución de problemas

| Problema | Causa probable | Qué hacer |
|---|---|---|
| La página tarda ~1 minuto en cargar la primera vez | El servicio estaba en reposo | Espere y recargue |
| «No se pudo conectar con la API…» | Sin Internet o servicio no disponible | Revise su conexión; si persiste, avise al administrador |
| No veo «Editar» ni «Eliminar» | Su rol es visor o analista | Es normal: solo se muestran las acciones permitidas |
| Aparece «No tiene permisos para realizar esta acción» | Intentó algo que su rol no permite | Pida el cambio de rol al administrador |
| El error muestra una **referencia** (código largo) | Falló algo interno del servidor | Anote la referencia y envíela al administrador: permite ubicar el evento exacto |
| La sesión se cerró sola | Pasaron 8 horas o se cambió el acceso | Inicie sesión de nuevo |

## 11. Buenas prácticas de seguridad

- No comparta su contraseña ni la escriba en chats o correos.
- Cierre la sesión en equipos compartidos.
- No registre en las descripciones contraseñas, números de tarjeta ni datos personales innecesarios.
- Si sospecha que alguien usó su cuenta, avise de inmediato al administrador.
