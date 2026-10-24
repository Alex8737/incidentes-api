import { esc, opciones } from './utils.js';

/** Componente: formulario de creación / edición */
export function FormIncidente(catalogos, inc = null) {
  const v = inc || { titulo: '', descripcion: '', categoria: 'otro', severidad: 'media', prioridad: 'media', estado: 'abierto', reportadoPor: '' };
  return `
    <label for="titulo">Título *</label>
    <input id="titulo" name="titulo" required minlength="5" maxlength="120" value="${esc(v.titulo)}" placeholder="Ej: Acceso sospechoso al servidor" />
    <div class="field-error" data-error="titulo"></div>

    <label for="descripcion">Descripción</label>
    <textarea id="descripcion" name="descripcion" placeholder="¿Qué ocurrió?">${esc(v.descripcion)}</textarea>

    <label for="categoria">Categoría</label>
    <select id="categoria" name="categoria">${opciones(catalogos.categorias, v.categoria)}</select>

    <label for="severidad">Severidad *</label>
    <select id="severidad" name="severidad">${opciones(catalogos.severidades, v.severidad)}</select>
    <div class="field-error" data-error="severidad"></div>

    <label for="prioridad">Prioridad</label>
    <select id="prioridad" name="prioridad">${opciones(catalogos.prioridades, v.prioridad)}</select>
    <div class="field-error" data-error="prioridad"></div>

    <label for="estado">Estado</label>
    <select id="estado" name="estado">${opciones(catalogos.estados, v.estado)}</select>

    <label for="reportadoPor">Reportado por</label>
    <input id="reportadoPor" name="reportadoPor" value="${esc(v.reportadoPor)}" placeholder="Nombre o área" />

    <div class="form-actions">
      <button type="submit" class="btn btn--primary">${inc ? 'Guardar cambios' : 'Crear incidente'}</button>
      ${inc ? '<button type="button" class="btn btn--ghost" data-action="cancelar">Cancelar</button>' : ''}
    </div>
  `;
}
