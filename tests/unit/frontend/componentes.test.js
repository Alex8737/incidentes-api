/**
 * PRUEBAS UNITARIAS — componentes de la vista (public/js/components)
 * Son funciones que devuelven HTML: se prueban sin navegador.
 * Incluyen las pruebas de regresión de los defectos 1, 2 y 3 encontrados con DevTools.
 */
import { esc, etiqueta, opciones } from '../../../public/js/components/utils.js';
import { Filtros } from '../../../public/js/components/Filtros.js';
import { IncidenteCard, ListaIncidentes } from '../../../public/js/components/IncidenteCard.js';
import { Paginacion } from '../../../public/js/components/Paginacion.js';
import { StatsPanel } from '../../../public/js/components/StatsPanel.js';
import { queryString } from '../../../public/js/api.js';

const catalogos = {
  estados: ['abierto', 'en_progreso', 'resuelto', 'cerrado'],
  prioridades: ['baja', 'media', 'alta', 'urgente'],
  severidades: ['baja', 'media', 'alta', 'critica'],
  categorias: ['phishing', 'malware', 'otro']
};
const inc = {
  id: 7, titulo: 'Ransomware en PC-VENTAS-07', descripcion: 'EDR bloqueó el cifrado', categoria: 'malware',
  severidad: 'critica', prioridad: 'urgente', estado: 'abierto', reportadoPor: 'SOC', fechaCreacion: '2026-09-21T09:15:00.000Z'
};
const ATAQUE = '"><img src=x onerror=alert(1)>';

describe('utils', () => {
  it('esc() neutraliza los 5 caracteres especiales de HTML', () => {
    expect(esc(`<a href="x" title='y'>&</a>`)).toBe('&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
    expect(esc(null)).toBe('');
  });

  it('etiqueta() convierte valores de catálogo en texto legible', () => {
    expect(etiqueta('acceso_no_autorizado')).toBe('Acceso no autorizado');
    expect(etiqueta('ddos')).toBe('DDoS');
    expect(etiqueta('critica')).toBe('Crítica');
  });

  it('opciones() marca la opción seleccionada y agrega la opción vacía', () => {
    const html = opciones(['baja', 'alta'], 'alta', 'Todas');
    expect(html).toContain('<option value="">Todas</option>');
    expect(html).toMatch(/value="alta" selected/);
  });
});

describe('Defecto 2: Filtros escapa el texto de búsqueda', () => {
  it('el texto con comillas y etiquetas NO crea elementos nuevos', () => {
    const html = Filtros(catalogos, { q: ATAQUE });
    expect(html).not.toContain('<img');
    expect(html).toContain('value="&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"');
  });

  it('conserva los filtros seleccionados', () => {
    const html = Filtros(catalogos, { q: 'vpn', estado: 'resuelto' });
    expect(html).toContain('value="vpn"');
    expect(html).toMatch(/value="resuelto" selected/);
  });
});

describe('Defecto 3: acciones de la tarjeta según permisos', () => {
  const acciones = html => ['estado', 'editar', 'eliminar'].filter(a => html.includes(`data-action="${a}"`));

  it('visor: solo lectura, sin botones ni cambio de estado', () => {
    expect(acciones(IncidenteCard(inc, catalogos, ['leer']))).toEqual([]);
  });

  it('analista: puede cambiar estado y editar, pero NO ve Eliminar', () => {
    expect(acciones(IncidenteCard(inc, catalogos, ['leer', 'escribir']))).toEqual(['estado', 'editar']);
  });

  it('admin: ve todas las acciones', () => {
    expect(acciones(IncidenteCard(inc, catalogos, ['leer', 'escribir', 'eliminar', 'verLogs']))).toEqual(['estado', 'editar', 'eliminar']);
  });

  it('escapa los datos del incidente (XSS almacenado)', () => {
    const html = IncidenteCard({ ...inc, titulo: '<script>robar()</script>', reportadoPor: ATAQUE }, catalogos, []);
    expect(html).not.toMatch(/<script>|<img/);
  });

  it('lista vacía muestra el mensaje correspondiente', () => {
    expect(ListaIncidentes([], catalogos, [])).toMatch('No hay incidentes');
  });
});

describe('Defecto 1: Paginacion', () => {
  it('no se muestra si todo entra en una página', () => {
    expect(Paginacion({ pagina: 1, paginas: 1, total: 12 })).toBe('');
    expect(Paginacion({ pagina: 1, paginas: 0, total: 0 })).toBe('');
  });

  it('muestra el total real y deshabilita "Anterior" en la primera página', () => {
    const html = Paginacion({ pagina: 1, paginas: 4, total: 155 });
    expect(html).toContain('Página 1 de 4 · 155 incidentes');
    expect(html).toMatch(/data-pagina="0" disabled/);
    expect(html).toMatch(/data-pagina="2" >/);
  });

  it('deshabilita "Siguiente" en la última página', () => {
    expect(Paginacion({ pagina: 4, paginas: 4, total: 155 })).toMatch(/data-pagina="5" disabled/);
  });
});

describe('StatsPanel y queryString', () => {
  it('muestra los totales y suma resueltos + cerrados', () => {
    const html = StatsPanel({
      total: 10, porEstado: { abierto: 4, en_progreso: 1, resuelto: 3, cerrado: 2 },
      porSeveridad: { critica: 2 }, porPrioridad: { urgente: 1 }
    });
    expect(html).toContain('<div class="stat__label">Resueltos</div><div class="stat__value">5</div>');
  });

  it('queryString omite filtros vacíos y codifica caracteres especiales', () => {
    expect(queryString({ q: 'SRV_WEB 100%', estado: '', prioridad: null, pagina: 2 })).toBe('?q=SRV_WEB+100%25&pagina=2');
    expect(queryString({})).toBe('');
  });
});
