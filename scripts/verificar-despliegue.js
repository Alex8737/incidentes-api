/**
 * VERIFICACIÓN DEL DESPLIEGUE (Reto 4: pruebas en el entorno productivo)
 *
 *   node scripts/verificar-despliegue.js https://su-servicio.onrender.com
 *   npm run verificar -- https://su-servicio.onrender.com
 *
 * Variables de entorno (solo en SU terminal; el script NUNCA imprime contraseñas ni tokens):
 *   VERIF_ADMIN_USER / VERIF_ADMIN_PASSWORD     cuenta con rol admin   (obligatorias)
 *   VERIF_VISOR_USER / VERIF_VISOR_PASSWORD     cuenta con rol visor   (opcionales: prueba autorización)
 *
 * Ejecuta un recorrido corto y repetible: HTTPS, salud, cabeceras, autenticación, CRUD completo,
 * validación, autorización por rol y ausencia de datos internos en los errores.
 * El incidente de prueba se crea y se ELIMINA al final (no se tocan registros reales).
 * El resultado queda en docs/evidencias/verificacion-produccion-<fecha>.txt
 */
const fs = require('fs');
const path = require('path');

const BASE = (process.argv[2] || process.env.URL_DESPLIEGUE || '').replace(/\/+$/, '');
const resultados = [];

function registrar(nombre, ok, detalle = '') {
  resultados.push({ nombre, ok, detalle });
  console.log(`${ok ? '[OK]   ' : '[FALLA]'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
}

/** Petición JSON; devuelve { estado, cuerpo, cabeceras }. Nunca lanza por códigos 4xx/5xx. */
async function pedir(metodo, ruta, { token, cuerpo, crudo } = {}) {
  const cabeceras = { Accept: 'application/json' };
  if (cuerpo !== undefined || crudo !== undefined) cabeceras['Content-Type'] = 'application/json';
  if (token) cabeceras.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${ruta}`, {
    method: metodo, headers: cabeceras, redirect: 'manual',
    body: crudo !== undefined ? crudo : (cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined),
    signal: AbortSignal.timeout(60000) // el plan gratuito puede tardar en "despertar"
  });
  const texto = await res.text();
  let json = null;
  try { json = JSON.parse(texto); } catch { /* respuesta no JSON (HTML, etc.) */ }
  return { estado: res.status, cuerpo: json, texto, cabeceras: res.headers };
}

async function iniciarSesion(usuario, password) {
  const r = await pedir('POST', '/api/auth/login', { cuerpo: { usuario, password } });
  return { ...r, token: r.cuerpo && r.cuerpo.token };
}

async function pruebasDeEntrada() {
  if (BASE.startsWith('https://')) {
    const r = await fetch(BASE.replace('https://', 'http://') + '/', { redirect: 'manual', signal: AbortSignal.timeout(60000) }).catch(() => null);
    const loc = r && r.headers.get('location');
    registrar('HTTP redirige a HTTPS', !!r && [301, 302, 307, 308].includes(r.status) && /^https:/.test(loc || ''), r ? `estado ${r.status}` : 'sin respuesta');
  } else {
    registrar('La URL usa HTTPS', false, 'la entrega debe ser https://');
  }

  const h = await pedir('GET', '/api/health');
  const salud = h.cuerpo || {};
  registrar('GET /api/health → 200 con base conectada', h.estado === 200 && salud.ok === true && salud.baseDeDatos?.conectada === true,
    `versión ${salud.version || '?'}, motor ${salud.baseDeDatos?.motor || '?'}${salud.commit ? `, commit ${salud.commit}` : ''}`);
  registrar('Cabecera HSTS presente', !!h.cabeceras.get('strict-transport-security'));
  registrar('Cabecera X-Content-Type-Options: nosniff', h.cabeceras.get('x-content-type-options') === 'nosniff');
  registrar('No revela la tecnología (sin X-Powered-By)', !h.cabeceras.get('x-powered-by'));
  registrar('Cada respuesta lleva X-Request-Id', !!h.cabeceras.get('x-request-id'));
  return salud;
}

async function pruebasDeAcceso() {
  const sin = await pedir('GET', '/api/incidentes');
  registrar('Sin token → 401', sin.estado === 401);
  const falso = await pedir('GET', '/api/incidentes', { token: 'token.invalido.firma' });
  registrar('Token inválido → 401', falso.estado === 401);
  const mala = await iniciarSesion('admin', 'clave-incorrecta-xyz');
  registrar('Credenciales inválidas → 401 con mensaje genérico', mala.estado === 401 && !/existe|no encontrado/i.test(mala.texto));
  const raro = await pedir('POST', '/api/auth/login', { crudo: '{no es json' });
  registrar('JSON mal formado → 400 sin pila interna', raro.estado === 400 && !/at .*\.js|node_modules/.test(raro.texto));
  const nada = await pedir('GET', '/api/no-existe');
  registrar('Ruta inexistente → 404 sin datos internos', nada.estado === 404 && !/at .*\.js|node_modules/.test(nada.texto));
}

async function cicloCrud(token) {
  const nuevo = {
    titulo: `Verificación automática ${new Date().toISOString().slice(0, 16)}`,
    descripcion: 'Registro temporal creado por verificar-despliegue.js (se elimina al final).',
    categoria: 'otro', severidad: 'baja', prioridad: 'baja', reportadoPor: 'verificador'
  };
  const crear = await pedir('POST', '/api/incidentes', { token, cuerpo: nuevo });
  const id = crear.cuerpo?.datos?.id;
  registrar('CRUD · crear → 201', crear.estado === 201 && !!id, `id ${id}`);
  if (!id) return;

  const leer = await pedir('GET', `/api/incidentes/${id}`, { token });
  registrar('CRUD · leer → 200 (persistido)', leer.estado === 200 && leer.cuerpo?.datos?.titulo === nuevo.titulo);
  const buscar = await pedir('GET', `/api/incidentes?q=${encodeURIComponent('Verificación automática')}`, { token });
  registrar('CRUD · listar con búsqueda → 200', buscar.estado === 200 && buscar.cuerpo?.datos?.some(i => i.id === id));
  const patch = await pedir('PATCH', `/api/incidentes/${id}`, { token, cuerpo: { estado: 'en_progreso' } });
  registrar('CRUD · actualizar estado → 200', patch.estado === 200 && patch.cuerpo?.datos?.estado === 'en_progreso');
  const invalido = await pedir('POST', '/api/incidentes', { token, cuerpo: { titulo: 'ab', severidad: 'extrema' } });
  registrar('Validación · datos inválidos → 400 con detalles', invalido.estado === 400 && Array.isArray(invalido.cuerpo?.error?.detalles));
  const masa = await pedir('POST', '/api/incidentes', { token, cuerpo: { ...nuevo, id: 99999, rol: 'admin' } });
  registrar('Validación · campos no permitidos (asignación masiva) → 400', masa.estado === 400);

  const borrar = await pedir('DELETE', `/api/incidentes/${id}`, { token });
  registrar('CRUD · eliminar → 204', borrar.estado === 204);
  const luego = await pedir('GET', `/api/incidentes/${id}`, { token });
  registrar('CRUD · leer eliminado → 404', luego.estado === 404);
}

async function pruebasDeVisor() {
  const usuario = process.env.VERIF_VISOR_USER;
  const clave = process.env.VERIF_VISOR_PASSWORD;
  if (!usuario || !clave) {
    registrar('Autorización por rol (visor)', true, 'OMITIDA: defina VERIF_VISOR_USER y VERIF_VISOR_PASSWORD para probarla');
    return;
  }
  const sesion = await iniciarSesion(usuario, clave);
  registrar('Visor · inicia sesión → 200', sesion.estado === 200 && !!sesion.token);
  if (!sesion.token) return;
  const lee = await pedir('GET', '/api/incidentes', { token: sesion.token });
  registrar('Visor · puede leer → 200', lee.estado === 200);
  const crea = await pedir('POST', '/api/incidentes', { token: sesion.token, cuerpo: { titulo: 'No debería crearse', severidad: 'baja' } });
  registrar('Visor · NO puede crear → 403', crea.estado === 403);
  const borra = await pedir('DELETE', '/api/incidentes/1', { token: sesion.token });
  registrar('Visor · NO puede eliminar → 403', borra.estado === 403);
  const logs = await pedir('GET', '/api/logs', { token: sesion.token });
  registrar('Visor · NO puede ver los logs → 403', logs.estado === 403);
}

async function pruebasDeMonitoreo(token) {
  const logs = await pedir('GET', '/api/logs', { token });
  const texto = logs.texto.toLowerCase();
  registrar('Logs (admin) → 200 y sin secretos', logs.estado === 200 && !/authorization|bearer |password/.test(texto));
  const m = await pedir('GET', '/api/metricas', { token });
  const d = m.cuerpo?.datos;
  registrar('Métricas (admin) → 200 con p95 y disponibilidad', m.estado === 200 && typeof d?.latenciaMs?.p95 === 'number',
    d ? `${d.solicitudes.total} solicitudes, 5xx=${d.solicitudes['5xx']}, p95=${d.latenciaMs.p95} ms, disponibilidad=${d.disponibilidadPct}%` : '');
}

function guardar(salud) {
  const fallas = resultados.filter(r => !r.ok).length;
  const dir = path.join(__dirname, '..', 'docs', 'evidencias');
  fs.mkdirSync(dir, { recursive: true });
  const sello = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
  const archivo = path.join(dir, `verificacion-produccion-${sello}.txt`);
  const lineas = [
    'VERIFICACIÓN DEL DESPLIEGUE EN PRODUCCIÓN',
    `URL: ${BASE}`,
    `Fecha: ${new Date().toLocaleString('es-EC')} · Node ${process.version}`,
    `Versión desplegada: ${salud.version || '?'}${salud.commit ? ` (commit ${salud.commit})` : ''} · entorno ${salud.entorno || '?'}`,
    `Resultado: ${fallas ? `${fallas} FALLA(S)` : 'TODAS LAS COMPROBACIONES PASARON'} (${resultados.length} comprobaciones)`,
    '='.repeat(70),
    ...resultados.map(r => `${r.ok ? '[OK]   ' : '[FALLA]'} ${r.nombre}${r.detalle ? ` — ${r.detalle}` : ''}`),
    ''
  ];
  fs.writeFileSync(archivo, lineas.join('\n'));
  console.log(`\nEvidencia guardada en ${path.relative(process.cwd(), archivo)}`);
  return fallas;
}

async function main() {
  if (!/^https?:\/\//.test(BASE)) {
    console.error('Uso: node scripts/verificar-despliegue.js https://su-servicio.onrender.com');
    process.exit(2);
  }
  if (!process.env.VERIF_ADMIN_USER || !process.env.VERIF_ADMIN_PASSWORD) {
    console.error('Defina VERIF_ADMIN_USER y VERIF_ADMIN_PASSWORD en su terminal (no se imprimen).');
    process.exit(2);
  }
  console.log(`Verificando ${BASE} …\n`);
  const salud = await pruebasDeEntrada();
  await pruebasDeAcceso();
  const admin = await iniciarSesion(process.env.VERIF_ADMIN_USER, process.env.VERIF_ADMIN_PASSWORD);
  registrar('Admin · inicia sesión → 200 con token', admin.estado === 200 && !!admin.token);
  if (admin.token) {
    await cicloCrud(admin.token);
    await pruebasDeVisor();
    await pruebasDeMonitoreo(admin.token);
  }
  process.exitCode = guardar(salud) ? 1 : 0;
}

main().catch(err => {
  console.error(`No se pudo completar la verificación: ${err.message}`);
  process.exit(1);
});
