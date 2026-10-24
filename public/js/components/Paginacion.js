/**
 * Componente: controles de paginación.
 * Defecto corregido (Reto 3 - U7): la API pagina de 50 en 50, pero la interfaz no tenía
 * forma de ver la página 2 en adelante y el contador mostraba 50 aunque hubiera más.
 */
export function Paginacion({ pagina, paginas, total }) {
  if (!paginas || paginas <= 1) return '';
  const anterior = pagina - 1;
  const siguiente = pagina + 1;
  return `
    <button type="button" class="btn btn--ghost btn--sm" data-pagina="${anterior}" ${anterior < 1 ? 'disabled' : ''}>← Anterior</button>
    <span class="paginacion__info">Página ${pagina} de ${paginas} · ${total} incidentes</span>
    <button type="button" class="btn btn--ghost btn--sm" data-pagina="${siguiente}" ${siguiente > paginas ? 'disabled' : ''}>Siguiente →</button>
  `;
}
