/**
 * PUNTO DE ENTRADA DEL FRONT-END
 * Solo arma las piezas del patrón MVC y gestiona la sesión (login / logout / expiración):
 *   Modelo       public/js/incidentes/modelo.js      estado + reglas de la pantalla + llamadas a la API
 *   Vista        public/js/incidentes/vista.js       dibuja el estado en el DOM
 *   Controlador  public/js/incidentes/controlador.js eventos del usuario <-> modelo <-> vista
 * La seguridad real está en el servidor; aquí solo se oculta lo que el rol no puede hacer.
 */
import { api, onSesionExpirada } from './api.js';
import { toast } from './components/Toast.js';
import { crearModeloIncidentes } from './incidentes/modelo.js';
import { crearVistaIncidentes } from './incidentes/vista.js';
import { crearControladorIncidentes } from './incidentes/controlador.js';

// ---------- Referencias DOM ----------
const $ = sel => document.querySelector(sel);
const el = {
  stats: $('#stats'), filtros: $('#filtros'), lista: $('#lista'), paginacion: $('#paginacion'),
  contador: $('#contador'), form: $('#form-incidente'), formTitle: $('#form-title'), avisoRol: $('#aviso-rol'),
  apiStatus: $('#api-status'), login: $('#login'), formLogin: $('#form-login'),
  loginError: $('#login-error'), usuarioInfo: $('#usuario-info'), btnSalir: $('#btn-salir')
};

// ---------- Piezas MVC ----------
const modelo = crearModeloIncidentes(api);
const vista = crearVistaIncidentes(el);
const controlador = crearControladorIncidentes({ modelo, vista, el, toast, confirmar: mensaje => window.confirm(mensaje) });

// ---------- Sesión ----------
function renderUsuario() {
  const { usuario } = modelo.state;
  el.usuarioInfo.textContent = usuario ? `${usuario.nombre} (${usuario.rol})` : '';
  el.btnSalir.hidden = !usuario;
}
modelo.suscribir(cambio => { if (cambio === 'usuario' || cambio === 'sesion') renderUsuario(); });

function mostrarLogin(mensaje = '') {
  modelo.cerrarSesion(); // borra incidentes, estadísticas y filtros del usuario anterior
  el.loginError.textContent = mensaje;
  el.login.hidden = false;
}

async function iniciarSesion(usuario, password) {
  modelo.iniciarSesion(await api.login(usuario, password));
  el.login.hidden = true;
  el.formLogin.reset();
  await controlador.iniciar();
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
  const boton = el.formLogin.querySelector('[type=submit]');
  boton.disabled = true;
  try {
    await iniciarSesion(datos.usuario.trim(), datos.password);
  } catch (err) {
    el.loginError.textContent = err.message;
  } finally {
    boton.disabled = false;
  }
});

el.btnSalir.addEventListener('click', () => {
  api.logout();
  mostrarLogin();
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
    el.lista.innerHTML = '<div class="error-box">No se pudo conectar con la API. Revise su conexión e intente de nuevo en unos minutos.</div>';
    return;
  }

  if (!api.haySesion()) {
    mostrarLogin();
    return;
  }
  try {
    modelo.iniciarSesion(await api.perfil());
    await controlador.iniciar();
  } catch {
    mostrarLogin('Su sesión expiró. Inicie sesión de nuevo.');
  }
}

init();
