/** Componente: tarjetas de resumen */
export function StatsPanel(stats) {
  const tarjetas = [
    { label: 'Total', valor: stats.total },
    { label: 'Abiertos', valor: stats.porEstado.abierto },
    { label: 'En progreso', valor: stats.porEstado.en_progreso },
    { label: 'Resueltos', valor: stats.porEstado.resuelto + stats.porEstado.cerrado },
    { label: 'Críticos', valor: stats.porSeveridad.critica },
    { label: 'Urgentes', valor: stats.porPrioridad?.urgente ?? 0 }
  ];
  return tarjetas
    .map(t => `<div class="stat"><div class="stat__label">${t.label}</div><div class="stat__value">${t.valor}</div></div>`)
    .join('');
}
