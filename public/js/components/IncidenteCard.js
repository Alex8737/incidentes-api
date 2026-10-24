import { esc, etiqueta, fecha, opciones } from './utils.js';

/**
 * Componente: tarjeta de un incidente. Las acciones dependen de los permisos que informa el servidor:
 *   leer -> solo ver · escribir -> cambiar estado y editar · eliminar -> borrar.
 * Defecto corregido: antes todos los roles veían los tres botones y el servidor respondía 403.
 */
export function IncidenteCard(inc, catalogos, permisos = []) {
  const puede = accion => permisos.includes(accion);
  const acciones = [
    puede('escribir') && `<select data-action="estado" aria-label="Cambiar estado">${opciones(catalogos.estados, inc.estado)}</select>`,
    puede('escribir') && '<button class="btn btn--ghost btn--sm" data-action="editar">Editar</button>',
    puede('eliminar') && '<button class="btn btn--danger btn--sm" data-action="eliminar">Eliminar</button>'
  ].filter(Boolean).join('\n        ');

  return `
    <article class="card" data-id="${inc.id}" data-sev="${esc(inc.severidad)}">
      <div class="card__top">
        <h3 class="card__title"><span class="card__id">#${inc.id}</span> ${esc(inc.titulo)}</h3>
        <span class="tag tag--${esc(inc.severidad)}">${esc(etiqueta(inc.severidad))}</span>
      </div>
      ${inc.descripcion ? `<p class="card__desc">${esc(inc.descripcion)}</p>` : ''}
      <div class="card__meta">
        <span class="tag tag--prio-${esc(inc.prioridad)}" title="Prioridad">⚑ ${esc(etiqueta(inc.prioridad))}</span>
        <span class="tag tag--estado">${esc(etiqueta(inc.estado))}</span>
        <span class="tag">${esc(etiqueta(inc.categoria))}</span>
        <span>· ${esc(inc.reportadoPor)}</span>
        <span>· ${fecha(inc.fechaCreacion)}</span>
      </div>
      ${acciones ? `<div class="card__actions">
        ${acciones}
      </div>` : ''}
    </article>
  `;
}

export function ListaIncidentes(incidentes, catalogos, permisos = []) {
  if (incidentes.length === 0) {
    return `<div class="empty">No hay incidentes que coincidan con los filtros.</div>`;
  }
  return incidentes.map(i => IncidenteCard(i, catalogos, permisos)).join('');
}
