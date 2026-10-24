/**
 * MODELO del módulo de incidentes (patrón MVC en el front-end)
 * - Guarda el ESTADO y aplica las reglas de la pantalla (paginación, filtros, permisos).
 * - Habla con la API, pero NO toca el DOM: avisa de los cambios a quien esté suscrito
 *   (el controlador), que decide qué redibujar con la vista.
 * - Al no depender del DOM se prueba con Jest usando una API falsa (tests/unit/frontend).
 */
export const FILTROS_VACIOS = Object.freeze({ q: '', estado: '', prioridad: '', severidad: '', categoria: '' });

const estadoInicial = () => ({
  usuario: null,          // { nombre, rol, permisos } de la sesión activa
  catalogos: null,
  incidentes: [],
  total: 0,               // total REAL que informa la API (no el tamaño de la página)
  pagina: 1,
  paginas: 0,
  stats: null,
  filtros: { ...FILTROS_VACIOS },
  editando: null,
  cargando: false,
  error: null
});

const esCancelacion = e => e?.name === 'AbortError';
const entre = (n, min, max) => Math.min(Math.max(min, Number(n) || min), max);

/** Carga de datos desde la API, con cancelación de la consulta anterior. */
function crearCargador({ api, obtenerEstado, notificar, sesionActual }) {
  let consultaEnCurso = null;

  async function cargarIncidentes() {
    consultaEnCurso?.abort(); // una respuesta vieja ya no debe pisar a la nueva
    const control = new AbortController();
    consultaEnCurso = control;
    const state = obtenerEstado();
    state.cargando = true; state.error = null; notificar('lista');
    try {
      const r = await api.listar({ ...state.filtros, pagina: state.pagina }, { signal: control.signal });
      if (control.signal.aborted) return;
      if (r.datos.length === 0 && state.pagina > 1 && r.total > 0) {
        state.pagina = r.paginas; // p. ej. se eliminó el último incidente de la última página
        await cargarIncidentes();
        return;
      }
      Object.assign(state, { incidentes: r.datos, total: r.total, paginas: r.paginas, pagina: r.pagina });
    } catch (e) {
      if (esCancelacion(e) || e.status === 401) return; // cancelada, o sesión expirada (ya se mostró el login)
      state.error = `No se pudieron cargar los incidentes: ${e.message}`;
    } finally {
      if (consultaEnCurso === control) { obtenerEstado().cargando = false; notificar('lista'); }
    }
  }

  async function cargarStats() {
    const sesion = sesionActual();
    try {
      const stats = await api.stats();
      if (sesion !== sesionActual()) return; // llegó después de cerrar sesión
      obtenerEstado().stats = stats;
      notificar('stats');
    } catch { /* no bloqueante: el tablero puede quedarse vacío */ }
  }

  return { cargarIncidentes, cargarStats, cancelar: () => consultaEnCurso?.abort() };
}

/** Operaciones de escritura. Devuelven el mensaje que verá el usuario. */
function crearAcciones({ api, obtenerEstado, notificar }) {
  return {
    async editar(id) {
      obtenerEstado().editando = await api.obtener(id);
      notificar('formulario');
    },
    cancelarEdicion() {
      obtenerEstado().editando = null;
      notificar('formulario');
    },
    /** Crea o reemplaza según haya un incidente en edición. */
    async guardar(datos) {
      const state = obtenerEstado();
      const editando = state.editando;
      const resultado = editando ? await api.reemplazar(editando.id, datos) : await api.crear(datos);
      state.editando = null;
      notificar('formulario');
      return editando ? `Incidente #${editando.id} actualizado` : `Incidente #${resultado.id} creado`;
    },
    async eliminar(id) {
      await api.eliminar(id);
      const state = obtenerEstado();
      if (state.editando?.id === id) { state.editando = null; notificar('formulario'); }
      return `Incidente #${id} eliminado`;
    },
    async cambiarEstado(id, estado) {
      await api.actualizar(id, { estado });
      return `Estado de #${id} cambiado a "${estado}"`;
    }
  };
}

export function crearModeloIncidentes(api) {
  let state = estadoInicial();
  let sesion = 0; // cambia al cerrar sesión: descarta respuestas de la sesión anterior
  const suscriptores = new Set();

  const obtenerEstado = () => state;
  const notificar = cambio => suscriptores.forEach(fn => fn(cambio, state));
  const carga = crearCargador({ api, obtenerEstado, notificar, sesionActual: () => sesion });
  const acciones = crearAcciones({ api, obtenerEstado, notificar });

  return {
    get state() { return state; },
    suscribir(fn) { suscriptores.add(fn); return () => suscriptores.delete(fn); },

    // ---------- sesión y permisos ----------
    iniciarSesion(usuario) { state.usuario = usuario; notificar('usuario'); },
    /** Cierra sesión y olvida TODO lo del usuario anterior (incluidos los filtros). */
    cerrarSesion() {
      carga.cancelar();
      sesion += 1;
      state = estadoInicial();
      notificar('sesion');
    },
    puede: accion => Boolean(state.usuario?.permisos?.includes(accion)),

    // ---------- carga ----------
    async cargarCatalogos() { state.catalogos = await api.catalogos(); notificar('catalogos'); },
    cargarIncidentes: carga.cargarIncidentes,
    cargarStats: carga.cargarStats,
    refrescar: () => Promise.all([carga.cargarIncidentes(), carga.cargarStats()]),

    // ---------- filtros y paginación ----------
    cambiarFiltro(nombre, valor) {
      if (!(nombre in FILTROS_VACIOS)) return;
      state.filtros = { ...state.filtros, [nombre]: valor };
      state.pagina = 1; // un filtro nuevo siempre empieza en la primera página
    },
    limpiarFiltros() { state.filtros = { ...FILTROS_VACIOS }; state.pagina = 1; },
    /** Cambia de página dentro del rango válido. Devuelve true si realmente cambió. */
    irAPagina(n) {
      const destino = entre(n, 1, Math.max(1, state.paginas));
      const cambio = destino !== state.pagina;
      state.pagina = destino;
      return cambio;
    },

    // ---------- edición ----------
    ...acciones
  };
}
