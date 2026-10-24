/**
 * CONTROLADOR del módulo de incidentes (patrón MVC en el front-end)
 * - Escucha los eventos del DOM y los traduce a operaciones del modelo.
 * - Escucha los cambios del modelo y pide a la vista que redibuje solo lo necesario.
 * No contiene reglas de negocio (están en el modelo) ni genera HTML (eso es de la vista).
 */
const ESPERA_BUSQUEDA_MS = 300;

/** Conecta los avisos del modelo con los métodos de la vista. */
function conectarModeloConVista(modelo, vista) {
  const redibujar = {
    lista: s => vista.lista(s),
    stats: s => vista.stats(s),
    formulario: s => vista.formulario(s),
    sesion: () => vista.limpiar()
  };
  modelo.suscribir((cambio, state) => redibujar[cambio]?.(state));
}

function eventosDeFiltros({ modelo, el }) {
  let espera;
  el.filtros.addEventListener('input', e => {
    modelo.cambiarFiltro(e.target.name, e.target.value);
    clearTimeout(espera);
    // Al escribir se espera un momento para no lanzar una consulta por cada tecla
    espera = setTimeout(modelo.cargarIncidentes, e.target.name === 'q' ? ESPERA_BUSQUEDA_MS : 0);
  });
  el.filtros.addEventListener('reset', () => {
    clearTimeout(espera);
    modelo.limpiarFiltros();
    setTimeout(modelo.cargarIncidentes, 0); // después de que el navegador limpie los campos
  });
  el.paginacion.addEventListener('click', e => {
    const boton = e.target.closest('[data-pagina]');
    if (boton && modelo.irAPagina(boton.dataset.pagina)) {
      modelo.cargarIncidentes();
      el.lista.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

function eventosDeFormulario({ modelo, vista, el, toast }) {
  el.form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!modelo.puede('escribir')) return;
    const datos = vista.datosFormulario();
    if (datos.titulo.trim().length < 5) {
      vista.erroresFormulario([{ campo: 'titulo', mensaje: 'Mínimo 5 caracteres' }]);
      return;
    }
    const boton = vista.botonGuardar();
    boton.disabled = true;
    try {
      toast(await modelo.guardar(datos));
      await modelo.refrescar();
    } catch (err) {
      if (err.status === 401) return; // la sesión expiró: ya se volvió al login
      vista.erroresFormulario(err.detalles);
      toast(err.message, 'error');
    } finally {
      boton.disabled = false;
    }
  });
  el.form.addEventListener('click', e => {
    if (e.target.dataset.action === 'cancelar') modelo.cancelarEdicion();
  });
}

function eventosDeTarjetas({ modelo, vista, el, toast, confirmar, ejecutar }) {
  const acciones = {
    editar: id => ejecutar(async () => { await modelo.editar(id); vista.irAlFormulario(); }, { refrescar: false }),
    eliminar: id => { if (confirmar(`¿Eliminar el incidente #${id}?`)) ejecutar(() => modelo.eliminar(id)); }
  };
  el.lista.addEventListener('click', e => {
    const accion = acciones[e.target.dataset.action];
    const tarjeta = e.target.closest('.card');
    if (accion && tarjeta) accion(Number(tarjeta.dataset.id));
  });
  el.lista.addEventListener('change', e => {
    if (e.target.dataset.action !== 'estado') return;
    const id = Number(e.target.closest('.card').dataset.id);
    ejecutar(() => modelo.cambiarEstado(id, e.target.value));
  });
  // 'toast' se usa dentro de ejecutar(); se recibe aquí para mantener la misma firma
  return toast;
}

export function crearControladorIncidentes({ modelo, vista, el, toast, confirmar }) {
  conectarModeloConVista(modelo, vista);

  /** Ejecuta una acción del usuario y muestra el resultado o el error en un aviso. */
  async function ejecutar(accion, { refrescar = true } = {}) {
    try {
      const mensaje = await accion();
      if (mensaje) toast(mensaje);
      if (refrescar) await modelo.refrescar();
      return true;
    } catch (err) {
      if (err.status !== 401) toast(err.message, 'error'); // 401: ya se volvió al login
      return false;
    }
  }

  eventosDeFiltros({ modelo, el });
  eventosDeFormulario({ modelo, vista, el, toast });
  eventosDeTarjetas({ modelo, vista, el, toast, confirmar, ejecutar });

  return {
    /** Carga catálogos, dibuja filtros y formulario y trae los datos de la sesión actual. */
    async iniciar() {
      await modelo.cargarCatalogos();
      vista.filtros(modelo.state);
      vista.formulario(modelo.state);
      await modelo.refrescar();
    }
  };
}
