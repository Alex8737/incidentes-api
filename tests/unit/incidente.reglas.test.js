/**
 * PRUEBAS UNITARIAS — reglas de negocio del incidente (src/models/incidente.reglas.js)
 * No usan base de datos ni HTTP: prueban funciones puras, por eso son rápidas y aisladas.
 */
const reglas = require('../../src/models/incidente.reglas');

const valido = {
  titulo: 'Escaneo de puertos desde IP externa',
  descripcion: 'El IDS detectó un escaneo.',
  categoria: 'acceso_no_autorizado',
  severidad: 'media',
  prioridad: 'alta',
  estado: 'abierto',
  reportadoPor: 'IDS'
};
const campos = errores => errores.map(e => e.campo).sort();

describe('validarIncidente — creación y reemplazo (completo)', () => {
  it('acepta un incidente válido', () => {
    expect(reglas.validarIncidente(valido)).toEqual([]);
  });

  it('acepta solo los obligatorios (título y severidad)', () => {
    expect(reglas.validarIncidente({ titulo: 'Acceso indebido', severidad: 'baja' })).toEqual([]);
  });

  it('exige título y severidad', () => {
    expect(campos(reglas.validarIncidente({}))).toEqual(['severidad', 'titulo']);
  });

  it.each([
    ['muy corto', 'abc'],
    ['solo espacios', '       '],
    ['no es texto', 12345],
    ['demasiado largo', 'x'.repeat(121)]
  ])('rechaza un título %s', (_caso, titulo) => {
    expect(campos(reglas.validarIncidente({ ...valido, titulo }))).toEqual(['titulo']);
  });

  it('acepta el título en los límites exactos (5 y 120 caracteres)', () => {
    expect(reglas.validarIncidente({ ...valido, titulo: 'x'.repeat(5) })).toEqual([]);
    expect(reglas.validarIncidente({ ...valido, titulo: 'x'.repeat(120) })).toEqual([]);
  });

  it.each(['severidad', 'prioridad', 'estado', 'categoria'])('rechaza %s fuera del catálogo', campo => {
    const errores = reglas.validarIncidente({ ...valido, [campo]: 'inventado' });
    expect(campos(errores)).toEqual([campo]);
    expect(errores[0].mensaje).toMatch(/Debe ser uno de/);
  });

  it('respeta los límites de descripción (2000) y reportadoPor (80)', () => {
    expect(reglas.validarIncidente({ ...valido, descripcion: 'd'.repeat(2000) })).toEqual([]);
    expect(campos(reglas.validarIncidente({ ...valido, descripcion: 'd'.repeat(2001) }))).toEqual(['descripcion']);
    expect(campos(reglas.validarIncidente({ ...valido, reportadoPor: 'r'.repeat(81) }))).toEqual(['reportadoPor']);
    expect(campos(reglas.validarIncidente({ ...valido, descripcion: 99 }))).toEqual(['descripcion']);
  });

  it('bloquea la asignación masiva (id, fechas u otros campos)', () => {
    const errores = reglas.validarIncidente({ ...valido, id: 7, fechaCreacion: '2000-01-01', rol: 'admin' });
    expect(campos(errores)).toEqual(['fechaCreacion', 'id', 'rol']);
    expect(errores.every(e => e.mensaje === 'Campo no permitido')).toBe(true);
  });

  it('acumula todos los errores en una sola respuesta', () => {
    const errores = reglas.validarIncidente({ titulo: 'abc', severidad: 'extrema', prioridad: 'ya' });
    expect(campos(errores)).toEqual(['prioridad', 'severidad', 'titulo']);
  });
});

describe('validarIncidente — actualización parcial (PATCH)', () => {
  const parcial = datos => reglas.validarIncidente(datos, { completo: false });

  it('permite enviar solo el estado', () => {
    expect(parcial({ estado: 'cerrado' })).toEqual([]);
  });

  it('no exige título ni severidad si no se envían', () => {
    expect(parcial({ prioridad: 'urgente' })).toEqual([]);
  });

  it('sí valida los campos que se envían', () => {
    expect(campos(parcial({ titulo: 'no', severidad: 'x' }))).toEqual(['severidad', 'titulo']);
  });
});

describe('normalizarIncidente y prepararReemplazo', () => {
  it('recorta espacios y no modifica el objeto original', () => {
    const entrada = { titulo: '  Phishing a contabilidad  ', reportadoPor: '  SOC ', severidad: 'alta' };
    const salida = reglas.normalizarIncidente(entrada);
    expect(salida).toEqual({ titulo: 'Phishing a contabilidad', reportadoPor: 'SOC', severidad: 'alta' });
    expect(entrada.titulo).toBe('  Phishing a contabilidad  ');
  });

  it('quita reportadoPor vacío para que el modelo use "Anónimo"', () => {
    expect(reglas.normalizarIncidente({ reportadoPor: '   ' })).not.toHaveProperty('reportadoPor');
  });

  it('PUT: los campos opcionales no enviados vuelven a su valor por defecto', () => {
    expect(reglas.prepararReemplazo({ titulo: 'Nuevo título', severidad: 'alta', estado: 'resuelto' })).toEqual({
      titulo: 'Nuevo título', severidad: 'alta', estado: 'resuelto',
      descripcion: '', categoria: 'otro', prioridad: 'media', reportadoPor: 'Anónimo'
    });
  });
});

describe('esIdValido', () => {
  it.each(['1', '42', '2147483647'])('acepta %s', id => expect(reglas.esIdValido(id)).toBe(true));
  it.each(['0', '-1', 'abc', '1.5', '2147483648', '', '1e3'])('rechaza "%s"', id => expect(reglas.esIdValido(id)).toBe(false));
});

describe('validarFiltros', () => {
  it('acepta filtros, paginación y orden válidos', () => {
    expect(reglas.validarFiltros({ estado: 'abierto', prioridad: 'alta', q: 'vpn', pagina: '2', limite: '20', orden: 'prioridad', dir: 'DESC' })).toEqual([]);
  });

  it('rechaza filtros no soportados y valores repetidos (?estado=a&estado=b)', () => {
    expect(campos(reglas.validarFiltros({ usuario: 'admin', estado: ['abierto', 'cerrado'] }))).toEqual(['estado', 'estado', 'usuario']);
  });

  it.each([
    ['estado', 'borrado'], ['pagina', '0'], ['limite', '1000'], ['orden', 'password'], ['dir', 'arriba'], ['q', 'x'.repeat(101)]
  ])('rechaza %s=%s', (campo, valor) => {
    expect(campos(reglas.validarFiltros({ [campo]: valor }))).toEqual([campo]);
  });
});

describe('calcularPaginacion y totalPaginas', () => {
  it('usa página 1 y 50 registros por defecto', () => {
    expect(reglas.calcularPaginacion({})).toEqual({ pagina: 1, limite: 50, offset: 0 });
  });

  it('calcula el desplazamiento (offset) de la página pedida', () => {
    expect(reglas.calcularPaginacion({ pagina: '3', limite: '20' })).toEqual({ pagina: 3, limite: 20, offset: 40 });
  });

  it.each([[0, 50, 0], [1, 50, 1], [50, 50, 1], [51, 50, 2], [155, 50, 4]])('total %i con límite %i = %i páginas', (total, limite, paginas) => {
    expect(reglas.totalPaginas(total, limite)).toBe(paginas);
  });
});

describe('patronBusqueda (corrige la búsqueda con % y _)', () => {
  it('envuelve el texto en % para buscar en cualquier posición', () => {
    expect(reglas.patronBusqueda('vpn')).toBe('%vpn%');
  });

  it('escapa los comodines para que se busquen literalmente', () => {
    expect(reglas.patronBusqueda('SRV_WEB')).toBe('%SRV!_WEB%');
    expect(reglas.patronBusqueda('100%')).toBe('%100!%%');
  });

  it('escapa también el propio carácter de escape', () => {
    expect(reglas.patronBusqueda('hola!')).toBe('%hola!!%');
  });
});

describe('resumirConteos (estadísticas con una sola consulta)', () => {
  const filas = [
    { estado: 'abierto', severidad: 'alta', prioridad: 'alta', cantidad: 2 },
    { estado: 'abierto', severidad: 'critica', prioridad: 'urgente', cantidad: '1' }, // MySQL devuelve texto
    { estado: 'resuelto', severidad: 'media', prioridad: 'alta', cantidad: 3 }
  ];

  it('suma el total y agrupa por estado, severidad y prioridad', () => {
    const r = reglas.resumirConteos(filas);
    expect(r.total).toBe(6);
    expect(r.porEstado).toEqual({ abierto: 3, en_progreso: 0, resuelto: 3, cerrado: 0 });
    expect(r.porSeveridad).toEqual({ baja: 0, media: 3, alta: 2, critica: 1 });
    expect(r.porPrioridad).toEqual({ baja: 0, media: 0, alta: 5, urgente: 1 });
  });

  it('con la tabla vacía devuelve todo en cero (nunca undefined)', () => {
    const r = reglas.resumirConteos([]);
    expect(r.total).toBe(0);
    expect(Object.values(r.porEstado).every(n => n === 0)).toBe(true);
    expect(Object.keys(r.porPrioridad)).toEqual(['baja', 'media', 'alta', 'urgente']);
  });
});
