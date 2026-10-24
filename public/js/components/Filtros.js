import { esc, opciones } from './utils.js';

/** Componente: barra de filtros (búsqueda, estado, prioridad, severidad, categoría) */
export function Filtros(catalogos, valores) {
  return `
    <div>
      <label for="f-q">Buscar</label>
      <input id="f-q" name="q" type="search" placeholder="Título o descripción…" value="${esc(valores.q)}" />
    </div>
    <div>
      <label for="f-estado">Estado</label>
      <select id="f-estado" name="estado">${opciones(catalogos.estados, valores.estado, 'Todos')}</select>
    </div>
    <div>
      <label for="f-prioridad">Prioridad</label>
      <select id="f-prioridad" name="prioridad">${opciones(catalogos.prioridades, valores.prioridad, 'Todas')}</select>
    </div>
    <div>
      <label for="f-severidad">Severidad</label>
      <select id="f-severidad" name="severidad">${opciones(catalogos.severidades, valores.severidad, 'Todas')}</select>
    </div>
    <div>
      <label for="f-categoria">Categoría</label>
      <select id="f-categoria" name="categoria">${opciones(catalogos.categorias, valores.categoria, 'Todas')}</select>
    </div>
    <button type="reset" class="btn btn--ghost">Limpiar</button>
  `;
}
