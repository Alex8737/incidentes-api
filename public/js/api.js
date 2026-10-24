/**
 * SERVICIO DE API (capa de acceso HTTP del front-end)
 * - Centraliza todas las llamadas Fetch.
 * - Envía el token JWT en la cabecera Authorization.
 * - Si el servidor responde 401 (sesión expirada), avisa a la aplicación para volver al login.
 * - Acepta una señal de cancelación (AbortSignal) para descartar consultas que ya no importan.
 */
const CLAVE_TOKEN = 'incidentes_token';
const PUERTOS_DE_DESARROLLO = ['5500', '5501']; // Live Server de VS Code: la API está en otro origen

/**
 * Defecto corregido: antes se usaba '/api' SOLO si el puerto era exactamente 3000. Con PORT=8080 en .env
 * (o detrás de un proxy en el puerto 80/443) el front llamaba a http://localhost:3000 y fallaba.
 * Ahora se usa siempre el mismo origen, salvo desde Live Server.
 */
export function resolverBaseUrl(ubicacion = globalThis.location) {
  return PUERTOS_DE_DESARROLLO.includes(ubicacion?.port) ? 'http://localhost:3000/api' : '/api';
}

/** { q: 'a b', estado: '' } -> "?q=a+b"  (omite vacíos y nulos) */
export function queryString(filtros = {}) {
  const params = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v !== '' && v != null));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

// Token en sessionStorage: se borra al cerrar la pestaña. Si el navegador lo bloquea, se usa solo en memoria.
let tokenEnMemoria = null;
const leerToken = () => {
  try { return sessionStorage.getItem(CLAVE_TOKEN) || tokenEnMemoria; } catch { return tokenEnMemoria; }
};
const guardarToken = t => {
  tokenEnMemoria = t;
  try { t ? sessionStorage.setItem(CLAVE_TOKEN, t) : sessionStorage.removeItem(CLAVE_TOKEN); } catch { /* sin almacenamiento */ }
};

let alSesionExpirar = () => {};
export const onSesionExpirada = fn => { alSesionExpirar = fn; };

/** Cabeceras de cada petición: JSON + token de sesión (si existe). */
function cabeceras(extra = {}) {
  const token = leerToken();
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}

async function leerJson(res) {
  try {
    return await res.json();
  } catch {
    throw new Error(`Respuesta no válida del servidor (${res.status})`);
  }
}

/** Convierte una respuesta de error de la API en un Error con `status` y `detalles` por campo. */
function errorDeApi(res, data) {
  const err = new Error(data?.error?.mensaje || `Error ${res.status}`);
  err.status = res.status;
  err.detalles = data?.error?.detalles || [];
  return err;
}

async function request(path, options = {}) {
  const res = await fetch(`${resolverBaseUrl()}${path}`, { ...options, headers: cabeceras(options.headers) });
  if (res.status === 204) return null; // DELETE sin contenido

  const data = await leerJson(res);
  if (res.ok) return data;

  // 401 en una ruta distinta del login = la sesión ya no es válida
  if (res.status === 401 && !path.startsWith('/auth/login')) {
    guardarToken(null);
    alSesionExpirar();
  }
  throw errorDeApi(res, data);
}

export const api = {
  health: () => request('/health'),

  async login(usuario, password) {
    const r = await request('/auth/login', { method: 'POST', body: JSON.stringify({ usuario, password }) });
    guardarToken(r.token);
    return r.datos;
  },
  logout: () => guardarToken(null),
  haySesion: () => !!leerToken(),
  perfil: () => request('/auth/me').then(r => r.datos),

  catalogos: () => request('/incidentes/catalogos').then(r => r.datos),
  stats: () => request('/incidentes/stats').then(r => r.datos),

  /**
   * Devuelve { datos, total, pagina, paginas }.
   * Defecto corregido: antes se descartaba todo salvo `datos`, y la pantalla no sabía cuántos
   * incidentes había en total (mostraba "50" aunque hubiera 155).
   */
  listar: (filtros = {}, { signal } = {}) =>
    request(`/incidentes${queryString(filtros)}`, { signal })
      .then(({ datos, total, pagina, paginas }) => ({ datos, total, pagina, paginas })),
  obtener: id => request(`/incidentes/${id}`).then(r => r.datos),
  crear: datos => request('/incidentes', { method: 'POST', body: JSON.stringify(datos) }).then(r => r.datos),
  reemplazar: (id, datos) => request(`/incidentes/${id}`, { method: 'PUT', body: JSON.stringify(datos) }).then(r => r.datos),
  actualizar: (id, cambios) => request(`/incidentes/${id}`, { method: 'PATCH', body: JSON.stringify(cambios) }).then(r => r.datos),
  eliminar: id => request(`/incidentes/${id}`, { method: 'DELETE' })
};
