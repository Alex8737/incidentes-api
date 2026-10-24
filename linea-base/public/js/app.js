/**
 * APLICACIÓN FRONT-END
 * - Mantiene un ESTADO único (state).
 * - Pide inicio de sesión antes de mostrar incidentes.
 * - Muestra u oculta acciones según el rol del usuario (la seguridad real está en el servidor).
 */
import { api, onSesionExpirada } from './api.js';
import { StatsPanel } from './components/StatsPanel.js';
import { Filtros } from './components/Filtros.js';
import { ListaIncidentes } from './components/IncidenteCard.js';
import { FormIncidente } from './components/FormIncidente.js';
import { toast } from './components/Toast.js';

// ---------- Estado ----------
const state = {
  usuario: null,    // { nombre, rol } de la sesión activa
  catalogos: null,
  incidentes: [],
  stats: null,
  filtros: { q: '', estado: '', prioridad: '', severidad: '', categoria: '' },
  editando: null,
  cargando: false,
  error: null
};

const PUEDE_ESCRIBIR = ['admin', 'analista'];

// ---------- Referencias DOM ----------
const $ = sel => document.querySelector(sel);
const el = {
  stats: $('#stats'), filtros: $('#filtros'), lista: $('#lista'),
  contador: $('#contador'), form: $('#form-incidente'), formTitle: $('#form-title'),
  apiStatus: $('#api-status'), login: $('#login'), formLogin: $('#form-login'),
  loginError: $('#login-error'), usuarioInfo: $('#usuario-info'), btnSalir: $('#btn-salir'),
  avisoRol: $('#aviso-rol')
};

const puedeEscribir = () => state.usuario && PUEDE_ESCRIBIR.includes(state.usuario.rol);

// ---------- Render ----------
function renderLista() {
  el.contador.textContent = state.incidentes.length;
  if (state.cargando) { el.lista.innerHTML = '<div class="loading">Cargando incidentes…</div>'; return; }
  if (state.error) { el.lista.innerHTML = `<div class="error-box">⚠️ ${state.error}</div>`; return; }
  el.lista.innerHTML = ListaIncidentes(state.incidentes, state.catalogos);
}
function renderStats() { if (state.stats) el.stats.innerHTML = StatsPanel(state.stats); }
function renderForm() {
  el.formTitle.textContent = state.editando ? `Editar incidente #${state.editando.id}` : 'Nuevo incidente';
  el.form.innerHTML = FormIncidente(state.catalogos, state.editando);
  const lectura = !puedeEscribir();
  el.form.querySelectorAll('input, select, textarea, button').forEach(c => { c.disabled = lectura; });
  el.avisoRol.innerHTML = lectura
    ? '<p class="aviso-rol">Su rol (visor) solo permite consultar incidentes.</p>' : '';
}
function renderFiltros() { el.filtros.innerHTML = Filtros(state.catalogos, state.filtros); }
function renderUsuario() {
  el.usuarioInfo.textContent = state.usuario ? `${state.usuario.nombre} (${state.usuario.rol})` : '';
  el.btnSalir.hidden = !state.usuario;
}

// ---------- Sesión ----------
function limpiarPantalla() {
  // Fallo corregido (Reto 3): al cerrar sesión los incidentes seguían visibles detrás del login
  state.incidentes = [];
  state.stats = null;
  state.editando = null;
  state.error = null;
  el.lista.innerHTML = '';
  el.stats.innerHTML = '';
  el.form.innerHTML = '';
  el.filtros.innerHTML = '';
  el.avisoRol.innerHTML = '';
  el.contador.textContent = '0';
}

function mostrarLogin(mensaje = '') {
  state.usuario = null;
  limpiarPantalla();
  el.loginError.textContent = mensaje;
  el.login.hidden = false;
  renderUsuario();
}

async function iniciarSesion(usuario, password) {
  state.usuario = await api.login(usuario, password);
  el.login.hidden = true;
  el.formLogin.reset();
  renderUsuario();
  await cargarDatos();
}

onSesionExpirada(() => mostrarLogin('Su sesión expiró. Inicie sesión de nuevo.'));

el.formLogin.addEventListener('submit', async e => {
  e.preventDefault();
  const datos = Object.fromEntries(new FormData(el.formLogin));
  el.loginError.textContent = '';
  if (!datos.usuario.trim() || !datos.password) {
    el.loginError.textContent = 'Complete usuario y contraseña.';
    return;
  }
  const btn = el.formLogin.querySelector('[type=submit]');
  btn.disabled = true;
  try {
    await iniciarSesion(datos.usuario.trim(), datos.password);
  } catch (err) {
    el.loginError.textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

el.btnSalir.addEventListener('click', () => {
  api.logout();
  state.editando = null;
  mostrarLogin();
});

// ---------- Carga de datos ----------
async function cargarIncidentes() {
  state.cargando = true; state.error = null; renderLista();
  try {
    state.incidentes = await api.listar(state.filtros);
  } catch (e) {
    if (e.status === 401) return; // ya se mostró el login
    state.error = `No se pudieron cargar los incidentes: ${e.message}`;
  } finally {
    state.cargando = false; renderLista();
  }
}
async function cargarStats() {
  try { state.stats = await api.stats(); renderStats(); } catch { /* no bloqueante */ }
}
const refrescar = () => Promise.all([cargarIncidentes(), cargarStats()]);

async function cargarDatos() {
  state.catalogos = await api.catalogos();
  renderFiltros();
  renderForm();
  await refrescar();
}

// ---------- Eventos: filtros ----------
let debounce;
el.filtros.addEventListener('input', e => {
  state.filtros[e.target.name] = e.target.value;
  clearTimeout(debounce);
  debounce = setTimeout(cargarIncidentes, e.target.name === 'q' ? 300 : 0);
});
el.filtros.addEventListener('reset', () => {
  state.filtros = { q: '', estado: '', prioridad: '', severidad: '', categoria: '' };
  setTimeout(cargarIncidentes, 0);
});

// ---------- Eventos: formulario ----------
function mostrarErrores(detalles = []) {
  el.form.querySelectorAll('[data-error]').forEach(d => (d.textContent = ''));
  detalles.forEach(({ campo, mensaje }) => {
    const box = el.form.querySelector(`[data-error="${campo}"]`);
    if (box) box.textContent = mensaje;
  });
}

el.form.addEventListener('submit', async e => {
  e.preventDefault();
  if (!puedeEscribir()) return;
  const datos = Object.fromEntries(new FormData(el.form));

  if (datos.titulo.trim().length < 5) {
    mostrarErrores([{ campo: 'titulo', mensaje: 'Mínimo 5 caracteres' }]);
    return;
  }

  const btn = el.form.querySelector('[type=submit]');
  btn.disabled = true;
  try {
    if (state.editando) {
      await api.reemplazar(state.editando.id, datos);
      toast(`Incidente #${state.editando.id} actualizado`);
      state.editando = null;
    } else {
      const nuevo = await api.crear(datos);
      toast(`Incidente #${nuevo.id} creado`);
    }
    renderForm();
    await refrescar();
  } catch (err) {
    if (err.status === 401) return;
    mostrarErrores(err.detalles);
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
});

el.form.addEventListener('click', e => {
  if (e.target.dataset.action === 'cancelar') { state.editando = null; renderForm(); }
});

// ---------- Eventos: acciones en tarjetas (delegación) ----------
el.lista.addEventListener('click', async e => {
  const accion = e.target.dataset.action;
  const card = e.target.closest('.card');
  if (!accion || !card) return;
  const id = Number(card.dataset.id);

  try {
    if (accion === 'editar') {
      if (!puedeEscribir()) return toast('Su rol no permite editar', 'error');
      state.editando = await api.obtener(id);
      renderForm();
      el.form.scrollIntoView({ behavior: 'smooth' });
    }
    if (accion === 'eliminar') {
      if (!confirm(`¿Eliminar el incidente #${id}?`)) return;
      await api.eliminar(id);
      toast(`Incidente #${id} eliminado`);
      if (state.editando?.id === id) { state.editando = null; renderForm(); }
      await refrescar();
    }
  } catch (err) {
    if (err.status === 401) return;
    toast(err.message, 'error');
  }
});

el.lista.addEventListener('change', async e => {
  if (e.target.dataset.action !== 'estado') return;
  if (!puedeEscribir()) { toast('Su rol no permite cambiar el estado', 'error'); return cargarIncidentes(); }
  const id = Number(e.target.closest('.card').dataset.id);
  try {
    await api.actualizar(id, { estado: e.target.value });
    toast(`Estado de #${id} cambiado a "${e.target.value}"`);
    await refrescar();
  } catch (err) {
    if (err.status === 401) return;
    toast(err.message, 'error');
  }
});

// ---------- Inicio ----------
async function init() {
  try {
    await api.health();
    el.apiStatus.textContent = '● API conectada';
    el.apiStatus.className = 'api-status ok';
  } catch {
    el.apiStatus.textContent = '● API sin conexión';
    el.apiStatus.className = 'api-status error';
    el.lista.innerHTML = `<div class="error-box">No se pudo conectar con la API. ¿Ejecutaste <code>npm start</code>?</div>`;
    return;
  }

  if (!api.haySesion()) return mostrarLogin();

  try {
    state.usuario = await api.perfil();
    renderUsuario();
    await cargarDatos();
  } catch {
    mostrarLogin('Su sesión expiró. Inicie sesión de nuevo.');
  }
}

init();
