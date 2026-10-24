/**
 * REGLAS DE NEGOCIO DEL INCIDENTE (capa Modelo del patrón MVC)
 *
 * Todas son funciones puras: no dependen de Express ni de la base de datos.
 * Por eso se pueden probar con pruebas unitarias (tests/unit/incidente.reglas.test.js)
 * y son la única fuente de verdad para el middleware HTTP y el repositorio.
 */
const { SEVERIDADES, PRIORIDADES, ESTADOS, CATEGORIAS } = require('./catalogos');

const CAMPOS_EDITABLES = Object.freeze(['titulo', 'descripcion', 'categoria', 'severidad', 'prioridad', 'estado', 'reportadoPor']);

/** Valores que toman los campos opcionales cuando no se envían (crear y reemplazar con PUT). */
const VALORES_POR_DEFECTO = Object.freeze({
  descripcion: '', categoria: 'otro', prioridad: 'media', estado: 'abierto', reportadoPor: 'Anónimo'
});

const LIMITES = Object.freeze({
  tituloMin: 5, tituloMax: 120, descripcionMax: 2000, reportadoPorMax: 80,
  busquedaMax: 100, paginaMax: 100000, limiteMax: 100, limitePorDefecto: 50, idMax: 2147483647
});

const ORDENABLES = Object.freeze(['id', 'fechaCreacion', 'fechaActualizacion', 'prioridad', 'severidad', 'estado', 'titulo']);
const FILTROS_PERMITIDOS = Object.freeze(['estado', 'prioridad', 'severidad', 'categoria', 'q', 'pagina', 'limite', 'orden', 'dir']);

/** Carácter de escape para LIKE. No es especial ni en SQLite, ni en MySQL, ni en PostgreSQL. */
const ESCAPE_LIKE = '!';

const error = (campo, mensaje) => ({ campo, mensaje });
const esObjetoPlano = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const esEnteroEnRango = (v, min, max) => /^\d+$/.test(String(v)) && Number(v) >= min && Number(v) <= max;

// ------------------------------------------------------------------ validación de campos
function validarCamposPermitidos(datos, permitidos, mensaje) {
  return Object.keys(datos).filter(c => !permitidos.includes(c)).map(c => error(c, mensaje));
}

function validarTitulo(titulo) {
  if (typeof titulo !== 'string' || titulo.trim().length < LIMITES.tituloMin) {
    return [error('titulo', `Es obligatorio y debe tener al menos ${LIMITES.tituloMin} caracteres`)];
  }
  if (titulo.trim().length > LIMITES.tituloMax) {
    return [error('titulo', `No puede superar ${LIMITES.tituloMax} caracteres`)];
  }
  return [];
}

function validarCatalogo(campo, valor, valores) {
  return valores.includes(valor) ? [] : [error(campo, `Debe ser uno de: ${valores.join(', ')}`)];
}

function validarTextoLibre(campo, valor, maximo) {
  if (typeof valor !== 'string') return [error(campo, 'Debe ser texto')];
  return valor.trim().length > maximo ? [error(campo, `No puede superar ${maximo} caracteres`)] : [];
}

/**
 * Valida los datos de un incidente.
 * @param {object} datos  cuerpo recibido
 * @param {{completo?: boolean}} opciones  completo=true en POST/PUT (titulo y severidad obligatorios), false en PATCH
 * @returns {{campo: string, mensaje: string}[]} lista de errores (vacía si es válido)
 */
function validarIncidente(datos, { completo = true } = {}) {
  const presente = campo => completo || datos[campo] !== undefined;
  const opcional = campo => datos[campo] !== undefined;
  const errores = validarCamposPermitidos(datos, CAMPOS_EDITABLES, 'Campo no permitido');

  if (presente('titulo')) errores.push(...validarTitulo(datos.titulo));
  if (presente('severidad')) errores.push(...validarCatalogo('severidad', datos.severidad, SEVERIDADES));
  if (opcional('prioridad')) errores.push(...validarCatalogo('prioridad', datos.prioridad, PRIORIDADES));
  if (opcional('estado')) errores.push(...validarCatalogo('estado', datos.estado, ESTADOS));
  if (opcional('categoria')) errores.push(...validarCatalogo('categoria', datos.categoria, CATEGORIAS));
  if (opcional('descripcion')) errores.push(...validarTextoLibre('descripcion', datos.descripcion, LIMITES.descripcionMax));
  if (opcional('reportadoPor')) errores.push(...validarTextoLibre('reportadoPor', datos.reportadoPor, LIMITES.reportadoPorMax));
  return errores;
}

/**
 * Devuelve una COPIA limpia: recorta espacios y, si reportadoPor queda vacío, lo quita
 * para que el modelo aplique su valor por defecto ("Anónimo"). No modifica el objeto original.
 */
function normalizarIncidente(datos) {
  const limpio = { ...datos };
  for (const campo of ['titulo', 'descripcion', 'reportadoPor']) {
    if (typeof limpio[campo] === 'string') limpio[campo] = limpio[campo].trim();
  }
  if (limpio.reportadoPor === '') delete limpio.reportadoPor;
  return limpio;
}

/** PUT es un reemplazo total: lo que no se envía vuelve a su valor por defecto. */
function prepararReemplazo(datos) {
  return { ...VALORES_POR_DEFECTO, ...datos };
}

// ------------------------------------------------------------------ identificadores y filtros
function esIdValido(id) {
  return esEnteroEnRango(id, 1, LIMITES.idMax);
}

function validarFiltroCatalogo(query) {
  const catalogos = { estado: ESTADOS, prioridad: PRIORIDADES, severidad: SEVERIDADES, categoria: CATEGORIAS };
  return Object.entries(catalogos)
    .filter(([campo]) => query[campo])
    .flatMap(([campo, valores]) => validarCatalogo(campo, query[campo], valores));
}

function validarPaginacion(query) {
  const errores = [];
  if (query.pagina !== undefined && !esEnteroEnRango(query.pagina, 1, LIMITES.paginaMax)) {
    errores.push(error('pagina', 'Debe ser un entero >= 1'));
  }
  if (query.limite !== undefined && !esEnteroEnRango(query.limite, 1, LIMITES.limiteMax)) {
    errores.push(error('limite', `Debe ser un entero entre 1 y ${LIMITES.limiteMax}`));
  }
  return errores;
}

function validarOrdenYBusqueda(query) {
  const errores = [];
  if (query.q !== undefined && String(query.q).length > LIMITES.busquedaMax) {
    errores.push(error('q', `Máximo ${LIMITES.busquedaMax} caracteres`));
  }
  if (query.orden !== undefined && !ORDENABLES.includes(query.orden)) {
    errores.push(error('orden', `Debe ser uno de: ${ORDENABLES.join(', ')}`));
  }
  if (query.dir !== undefined && !['asc', 'desc'].includes(String(query.dir).toLowerCase())) {
    errores.push(error('dir', 'Debe ser asc o desc'));
  }
  return errores;
}

/** Valida el query string de GET /incidentes. Devuelve la lista de errores. */
function validarFiltros(query) {
  const errores = Object.keys(query).flatMap(clave => {
    if (!FILTROS_PERMITIDOS.includes(clave)) return [error(clave, 'Filtro no soportado')];
    if (typeof query[clave] !== 'string') return [error(clave, 'Debe enviarse una sola vez')];
    return [];
  });
  return [...errores, ...validarFiltroCatalogo(query), ...validarPaginacion(query), ...validarOrdenYBusqueda(query)];
}

/** Paginación con valores por defecto: { pagina, limite, offset }. */
function calcularPaginacion({ pagina, limite } = {}) {
  const p = Number(pagina) || 1;
  const l = Number(limite) || LIMITES.limitePorDefecto;
  return { pagina: p, limite: l, offset: (p - 1) * l };
}

const totalPaginas = (total, limite) => (total > 0 ? Math.ceil(total / limite) : 0);

/**
 * Patrón LIKE seguro para la búsqueda de texto (q).
 * Escapa los comodines % y _ (y el propio carácter de escape) para que se busquen
 * de forma LITERAL. Se usa junto con  ESCAPE '!'  en la consulta.
 */
function patronBusqueda(texto) {
  const escapado = String(texto).replace(/[!%_]/g, c => `${ESCAPE_LIKE}${c}`);
  return `%${escapado}%`;
}

// ------------------------------------------------------------------ estadísticas
/** Rellena con 0 los valores del catálogo que no aparecen en el conteo. */
function completarConteo(conteo, valores) {
  return Object.fromEntries(valores.map(v => [v, conteo[v] || 0]));
}

/**
 * Convierte las filas de  GROUP BY estado, severidad, prioridad  en el resumen del tablero.
 * @param {{estado: string, severidad: string, prioridad: string, cantidad: number|string}[]} filas
 */
function resumirConteos(filas) {
  const acumular = (acc, clave, n) => ({ ...acc, [clave]: (acc[clave] || 0) + n });
  const base = { total: 0, porEstado: {}, porSeveridad: {}, porPrioridad: {} };
  const suma = filas.reduce((r, f) => {
    const n = Number(f.cantidad);
    return {
      total: r.total + n,
      porEstado: acumular(r.porEstado, f.estado, n),
      porSeveridad: acumular(r.porSeveridad, f.severidad, n),
      porPrioridad: acumular(r.porPrioridad, f.prioridad, n)
    };
  }, base);
  return {
    total: suma.total,
    porEstado: completarConteo(suma.porEstado, ESTADOS),
    porSeveridad: completarConteo(suma.porSeveridad, SEVERIDADES),
    porPrioridad: completarConteo(suma.porPrioridad, PRIORIDADES)
  };
}

module.exports = {
  CAMPOS_EDITABLES, VALORES_POR_DEFECTO, LIMITES, ORDENABLES, FILTROS_PERMITIDOS, ESCAPE_LIKE,
  esObjetoPlano, validarIncidente, normalizarIncidente, prepararReemplazo,
  esIdValido, validarFiltros, calcularPaginacion, totalPaginas, patronBusqueda,
  completarConteo, resumirConteos
};
