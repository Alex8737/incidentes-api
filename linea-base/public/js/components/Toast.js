/** Componente: notificación temporal */
let timer;
export function toast(mensaje, tipo = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = mensaje;
  el.className = `toast show ${tipo}`;
  clearTimeout(timer);
  timer = setTimeout(() => (el.className = 'toast'), 3000);
}
