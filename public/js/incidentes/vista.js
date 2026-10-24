/**
 * VISTA del módulo de incidentes (patrón MVC en el front-end)
 * - Solo dibuja: recibe el estado y escribe en el DOM usando los componentes.
 * - No llama a la API ni decide reglas; tampoco registra eventos (eso es del controlador).
 */
import { StatsPanel } from '../components/StatsPanel.js';
import { Filtros } from '../components/Filtros.js';
import { ListaIncidentes } from '../components/IncidenteCard.js';
import { FormIncidente } from '../components/FormIncidente.js';
import { Paginacion } from '../components/Paginacion.js';
import { esc } from '../components/utils.js';

const permisosDe = state => state.usuario?.permisos || [];

export function crearVistaIncidentes(el) {
  return {
    lista(state) {
      // Defecto corregido: el contador mostraba la cantidad de la página (máx. 50), no el total real
      el.contador.textContent = String(state.total);
      el.paginacion.innerHTML = state.cargando || state.error ? '' : Paginacion(state);
      if (state.cargando) { el.lista.innerHTML = '<div class="loading">Cargando incidentes…</div>'; return; }
      if (state.error) { el.lista.innerHTML = `<div class="error-box">⚠️ ${esc(state.error)}</div>`; return; }
      el.lista.innerHTML = ListaIncidentes(state.incidentes, state.catalogos, permisosDe(state));
    },

    stats(state) {
      el.stats.innerHTML = state.stats ? StatsPanel(state.stats) : '';
    },

    filtros(state) {
      el.filtros.innerHTML = Filtros(state.catalogos, state.filtros);
    },

    formulario(state) {
      const puedeEscribir = permisosDe(state).includes('escribir');
      el.formTitle.textContent = state.editando ? `Editar incidente #${state.editando.id}` : 'Nuevo incidente';
      el.form.innerHTML = FormIncidente(state.catalogos, state.editando);
      el.form.querySelectorAll('input, select, textarea, button').forEach(c => { c.disabled = !puedeEscribir; });
      el.avisoRol.innerHTML = puedeEscribir
        ? '' : '<p class="aviso-rol">Su rol (visor) solo permite consultar incidentes.</p>';
    },

    /** Deja la pantalla en blanco (al cerrar sesión no deben quedar datos del usuario anterior). */
    limpiar() {
      ['lista', 'stats', 'form', 'filtros', 'avisoRol', 'paginacion'].forEach(k => { el[k].innerHTML = ''; });
      el.contador.textContent = '0';
      el.formTitle.textContent = 'Nuevo incidente';
    },

    erroresFormulario(detalles = []) {
      el.form.querySelectorAll('[data-error]').forEach(d => { d.textContent = ''; });
      detalles.forEach(({ campo, mensaje }) => {
        const caja = el.form.querySelector(`[data-error="${CSS.escape(campo)}"]`);
        if (caja) caja.textContent = mensaje;
      });
    },

    datosFormulario: () => Object.fromEntries(new FormData(el.form)),
    botonGuardar: () => el.form.querySelector('[type=submit]'),
    irAlFormulario: () => el.form.scrollIntoView({ behavior: 'smooth' })
  };
}
