/**
 * SERVICIO DE API (capa de acceso HTTP del front-end)
 * - Centraliza todas las llamadas Fetch.
 * - Envía el token JWT en la cabecera Authorization.
 * - Si el servidor responde 401 (sesión expirada), avisa a la aplicación para volver al login.
 */
const BASE_URL = location.port === '3000' ? '/api' : 'http://localhost:3000/api';
const CLAVE_TOKEN = 'incidentes_token';

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

async function request(path, options = {}) {
  const token = leerToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  if (res.status === 204) return null; // DELETE sin contenido

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Respuesta no válida del servidor (${res.status})`);
  }

  if (!res.ok) {
    // 401 en una ruta distinta del login = la sesión ya no es válida
    if (res.status === 401 && !path.startsWith('/auth/login')) {
      guardarToken(null);
      alSesionExpirar();
    }
    const err = new Error(data?.error?.mensaje || `Error ${res.status}`);
    err.status = res.status;
    err.detalles = data?.error?.detalles || [];
    throw err;
  }
  return data;
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

  listar(filtros = {}) {
    const params = new URLSearchParams(
      Object.entries(filtros).filter(([, v]) => v !== '' && v != null)
    );
    const qs = params.toString();
    return request(`/incidentes${qs ? `?${qs}` : ''}`).then(r => r.datos);
  },
  obtener: id => request(`/incidentes/${id}`).then(r => r.datos),
  crear: datos => request('/incidentes', { method: 'POST', body: JSON.stringify(datos) }).then(r => r.datos),
  reemplazar: (id, datos) => request(`/incidentes/${id}`, { method: 'PUT', body: JSON.stringify(datos) }).then(r => r.datos),
  actualizar: (id, cambios) => request(`/incidentes/${id}`, { method: 'PATCH', body: JSON.stringify(cambios) }).then(r => r.datos),
  eliminar: id => request(`/incidentes/${id}`, { method: 'DELETE' })
};
