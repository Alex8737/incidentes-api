/** Escapa HTML para evitar XSS al renderizar datos del usuario */
export function esc(valor) {
  return String(valor ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

/** "acceso_no_autorizado" -> "Acceso no autorizado" */
const ESPECIALES = { ddos: 'DDoS', critica: 'Crítica' };
export function etiqueta(valor) {
  if (ESPECIALES[valor]) return ESPECIALES[valor];
  const t = String(valor).replaceAll('_', ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function fecha(iso) {
  return new Date(iso).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' });
}

export function opciones(valores, seleccionado = '', vacio = null) {
  const primera = vacio ? `<option value="">${esc(vacio)}</option>` : '';
  return primera + valores
    .map(v => `<option value="${esc(v)}" ${v === seleccionado ? 'selected' : ''}>${esc(etiqueta(v))}</option>`)
    .join('');
}
