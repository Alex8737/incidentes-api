/**
 * PRUEBAS UNITARIAS — modelo del módulo de incidentes (public/js/incidentes/modelo.js)
 * Se usa una API FALSA (dobles de prueba con jest.fn): no hay servidor ni navegador.
 */
import { crearModeloIncidentes, FILTROS_VACIOS } from '../../../public/js/incidentes/modelo.js';

const pagina = (datos, total, numero = 1, paginas = Math.ceil(total / 50)) => ({ datos, total, pagina: numero, paginas });
const incidentes = n => Array.from({ length: n }, (_, i) => ({ id: i + 1, titulo: `Incidente ${i + 1}` }));

function apiFalsa(extra = {}) {
  return {
    listar: jest.fn().mockResolvedValue(pagina(incidentes(50), 155)),
    stats: jest.fn().mockResolvedValue({ total: 155 }),
    catalogos: jest.fn().mockResolvedValue({ estados: [] }),
    obtener: jest.fn(id => Promise.resolve({ id, titulo: 'En edición' })),
    crear: jest.fn().mockResolvedValue({ id: 99 }),
    reemplazar: jest.fn().mockResolvedValue({ id: 5 }),
    eliminar: jest.fn().mockResolvedValue(null),
    actualizar: jest.fn().mockResolvedValue({}),
    ...extra
  };
}

describe('Defecto 1: total y paginación', () => {
  it('guarda el total REAL de la API, no la cantidad de la página', async () => {
    const modelo = crearModeloIncidentes(apiFalsa());
    await modelo.cargarIncidentes();
    expect(modelo.state.incidentes).toHaveLength(50);
    expect(modelo.state.total).toBe(155);
    expect(modelo.state.paginas).toBe(4);
  });

  it('pide la página actual junto con los filtros', async () => {
    const api = apiFalsa();
    const modelo = crearModeloIncidentes(api);
    await modelo.cargarIncidentes();
    modelo.cambiarFiltro('estado', 'abierto');
    modelo.irAPagina(1);
    await modelo.cargarIncidentes();
    expect(api.listar).toHaveBeenLastCalledWith({ ...FILTROS_VACIOS, estado: 'abierto', pagina: 1 }, expect.anything());
  });

  it('irAPagina se mantiene dentro de 1..paginas e indica si hubo cambio', async () => {
    const modelo = crearModeloIncidentes(apiFalsa());
    await modelo.cargarIncidentes();
    expect(modelo.irAPagina(3)).toBe(true);
    expect(modelo.state.pagina).toBe(3);
    expect(modelo.irAPagina(99)).toBe(true);
    expect(modelo.state.pagina).toBe(4);
    expect(modelo.irAPagina(4)).toBe(false);
    modelo.irAPagina(-5);
    expect(modelo.state.pagina).toBe(1);
  });

  it('un filtro nuevo vuelve a la página 1', async () => {
    const modelo = crearModeloIncidentes(apiFalsa());
    await modelo.cargarIncidentes();
    modelo.irAPagina(3);
    modelo.cambiarFiltro('q', 'vpn');
    expect(modelo.state.pagina).toBe(1);
  });

  it('si la página quedó vacía (se eliminó el último registro) salta a la última con datos', async () => {
    const api = apiFalsa({
      listar: jest.fn()
        .mockResolvedValueOnce(pagina([], 100, 3, 2))
        .mockResolvedValueOnce(pagina(incidentes(50), 100, 2, 2))
    });
    const modelo = crearModeloIncidentes(api);
    modelo.state.paginas = 3;
    modelo.irAPagina(3);
    await modelo.cargarIncidentes();
    expect(api.listar).toHaveBeenCalledTimes(2);
    expect(modelo.state.pagina).toBe(2);
    expect(modelo.state.incidentes).toHaveLength(50);
  });
});

describe('Defecto 2: el cierre de sesión borra los datos y los filtros', () => {
  it('después de cerrar sesión no queda nada del usuario anterior', async () => {
    const modelo = crearModeloIncidentes(apiFalsa());
    modelo.iniciarSesion({ nombre: 'Ana', rol: 'admin', permisos: ['leer'] });
    await modelo.refrescar();
    modelo.cambiarFiltro('q', '"><img src=x onerror=alert(1)>');
    modelo.cerrarSesion();
    expect(modelo.state.filtros).toEqual(FILTROS_VACIOS);
    expect(modelo.state).toMatchObject({ usuario: null, incidentes: [], total: 0, stats: null, pagina: 1 });
  });

  it('una respuesta de estadísticas que llega tarde no se muestra en la sesión siguiente', async () => {
    let responder;
    const api = apiFalsa({ stats: jest.fn(() => new Promise(r => { responder = r; })) });
    const modelo = crearModeloIncidentes(api);
    const pendiente = modelo.cargarStats();
    modelo.cerrarSesion();
    responder({ total: 155 });
    await pendiente;
    expect(modelo.state.stats).toBeNull();
  });

  it('ignora nombres de filtro que no existen', () => {
    const modelo = crearModeloIncidentes(apiFalsa());
    modelo.cambiarFiltro('usuario', 'admin');
    expect(modelo.state.filtros).toEqual(FILTROS_VACIOS);
  });
});

describe('Búsquedas concurrentes', () => {
  it('cancela la búsqueda anterior y una respuesta vieja no pisa a la nueva', async () => {
    const pendientes = [];
    const api = apiFalsa({
      listar: jest.fn((_filtros, { signal }) => new Promise(resolve => pendientes.push({ resolve, signal })))
    });
    const modelo = crearModeloIncidentes(api);
    const primera = modelo.cargarIncidentes();   // p. ej. "ran"
    const segunda = modelo.cargarIncidentes();   // p. ej. "ransomware"
    expect(pendientes[0].signal.aborted).toBe(true);
    pendientes[1].resolve(pagina([{ id: 2, titulo: 'nueva' }], 1));
    pendientes[0].resolve(pagina([{ id: 1, titulo: 'vieja' }], 1));
    await Promise.all([primera, segunda]);
    expect(modelo.state.incidentes).toEqual([{ id: 2, titulo: 'nueva' }]);
    expect(modelo.state.cargando).toBe(false);
  });
});

describe('Errores al cargar', () => {
  it('muestra un mensaje si la API falla', async () => {
    const modelo = crearModeloIncidentes(apiFalsa({ listar: jest.fn().mockRejectedValue(new Error('Error 500')) }));
    await modelo.cargarIncidentes();
    expect(modelo.state.error).toBe('No se pudieron cargar los incidentes: Error 500');
  });

  it('un 401 no muestra error (la aplicación ya vuelve al login)', async () => {
    const err = Object.assign(new Error('Sesión no válida'), { status: 401 });
    const modelo = crearModeloIncidentes(apiFalsa({ listar: jest.fn().mockRejectedValue(err) }));
    await modelo.cargarIncidentes();
    expect(modelo.state.error).toBeNull();
  });
});

describe('Permisos y edición', () => {
  it('puede() usa los permisos que envió el servidor', () => {
    const modelo = crearModeloIncidentes(apiFalsa());
    expect(modelo.puede('escribir')).toBe(false); // sin sesión
    modelo.iniciarSesion({ nombre: 'Luis', rol: 'analista', permisos: ['leer', 'escribir'] });
    expect(modelo.puede('escribir')).toBe(true);
    expect(modelo.puede('eliminar')).toBe(false);
  });

  it('guardar() crea si no hay edición y reemplaza si la hay', async () => {
    const api = apiFalsa();
    const modelo = crearModeloIncidentes(api);
    expect(await modelo.guardar({ titulo: 'Nuevo incidente' })).toBe('Incidente #99 creado');
    await modelo.editar(5);
    expect(modelo.state.editando).toEqual({ id: 5, titulo: 'En edición' });
    expect(await modelo.guardar({ titulo: 'Editado' })).toBe('Incidente #5 actualizado');
    expect(api.reemplazar).toHaveBeenCalledWith(5, { titulo: 'Editado' });
    expect(modelo.state.editando).toBeNull();
  });

  it('eliminar el incidente que se está editando limpia el formulario', async () => {
    const modelo = crearModeloIncidentes(apiFalsa());
    await modelo.editar(5);
    expect(await modelo.eliminar(5)).toBe('Incidente #5 eliminado');
    expect(modelo.state.editando).toBeNull();
  });

  it('notifica a los suscriptores qué parte cambió', async () => {
    const modelo = crearModeloIncidentes(apiFalsa());
    const cambios = [];
    const desuscribir = modelo.suscribir(c => cambios.push(c));
    await modelo.refrescar();
    desuscribir();
    modelo.cancelarEdicion();
    expect(cambios).toEqual(['lista', 'lista', 'stats']);
  });
});
