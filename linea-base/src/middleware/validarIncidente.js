/**
 * VALIDACIONES HTTP (primera capa, antes de llegar al ORM)
 * - validarIncidente: body de POST / PUT (completo) y PATCH (parcial)
 * - validarId:        :id entero positivo
 * - validarFiltros:   query string de GET /incidentes
 */
const AppError = require('../utils/AppError');
const { SEVERIDADES, PRIORIDADES, ESTADOS, CATEGORIAS } = require('../models/catalogos');

const CAMPOS_PERMITIDOS = ['titulo', 'descripcion', 'categoria', 'severidad', 'prioridad', 'estado', 'reportadoPor'];

function validarIncidente(completo = true) {
  return (req, res, next) => {
    const body = req.body;

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return next(new AppError('El cuerpo debe ser un objeto JSON', 400));
    }
    if (!completo && Object.keys(body).length === 0) {
      return next(new AppError('Debe enviar al menos un campo para actualizar', 400));
    }

    const errores = [];

    // Protección contra asignación masiva: no se aceptan campos desconocidos (id, fechas, etc.)
    Object.keys(body)
      .filter(c => !CAMPOS_PERMITIDOS.includes(c))
      .forEach(c => errores.push({ campo: c, mensaje: 'Campo no permitido' }));

    // titulo
    if (completo || body.titulo !== undefined) {
      if (typeof body.titulo !== 'string' || body.titulo.trim().length < 5) {
        errores.push({ campo: 'titulo', mensaje: 'Es obligatorio y debe tener al menos 5 caracteres' });
      } else if (body.titulo.trim().length > 120) {
        errores.push({ campo: 'titulo', mensaje: 'No puede superar 120 caracteres' });
      }
    }
    // severidad (obligatoria al crear/reemplazar)
    if (completo || body.severidad !== undefined) {
      if (!SEVERIDADES.includes(body.severidad)) {
        errores.push({ campo: 'severidad', mensaje: `Debe ser uno de: ${SEVERIDADES.join(', ')}` });
      }
    }
    // opcionales con valores cerrados
    const cerrados = { prioridad: PRIORIDADES, estado: ESTADOS, categoria: CATEGORIAS };
    for (const [campo, valores] of Object.entries(cerrados)) {
      if (body[campo] !== undefined && !valores.includes(body[campo])) {
        errores.push({ campo, mensaje: `Debe ser uno de: ${valores.join(', ')}` });
      }
    }
    // textos libres
    if (body.descripcion !== undefined) {
      if (typeof body.descripcion !== 'string') errores.push({ campo: 'descripcion', mensaje: 'Debe ser texto' });
      else if (body.descripcion.length > 2000) errores.push({ campo: 'descripcion', mensaje: 'No puede superar 2000 caracteres' });
    }
    if (body.reportadoPor !== undefined) {
      if (typeof body.reportadoPor !== 'string') errores.push({ campo: 'reportadoPor', mensaje: 'Debe ser texto' });
      else if (body.reportadoPor.trim().length > 80) errores.push({ campo: 'reportadoPor', mensaje: 'No puede superar 80 caracteres' });
    }

    if (errores.length > 0) {
      return next(new AppError('Datos de incidente inválidos', 400, errores));
    }

    // Sanitización básica: recortar espacios; vacíos opcionales -> valor por defecto del modelo
    ['titulo', 'descripcion', 'reportadoPor'].forEach(c => {
      if (typeof body[c] === 'string') body[c] = body[c].trim();
    });
    if (body.reportadoPor === '') delete body.reportadoPor;
    if (body.categoria === '') delete body.categoria;

    next();
  };
}

/** Valida que :id sea un entero positivo */
function validarId(req, res, next) {
  const { id } = req.params;
  if (!/^\d+$/.test(id) || Number(id) <= 0 || Number(id) > 2147483647) {
    return next(new AppError(`El id "${id}" no es válido`, 400));
  }
  next();
}

const ORDENABLES = ['id', 'fechaCreacion', 'fechaActualizacion', 'prioridad', 'severidad', 'estado', 'titulo'];
const FILTROS_PERMITIDOS = ['estado', 'prioridad', 'severidad', 'categoria', 'q', 'pagina', 'limite', 'orden', 'dir'];

/** Valida los filtros y la paginación de GET /incidentes */
function validarFiltros(req, res, next) {
  const q = req.query;
  const errores = [];

  for (const clave of Object.keys(q)) {
    if (!FILTROS_PERMITIDOS.includes(clave)) errores.push({ campo: clave, mensaje: 'Filtro no soportado' });
    else if (typeof q[clave] !== 'string') errores.push({ campo: clave, mensaje: 'Debe enviarse una sola vez' });
  }

  const cerrados = { estado: ESTADOS, prioridad: PRIORIDADES, severidad: SEVERIDADES, categoria: CATEGORIAS };
  for (const [campo, valores] of Object.entries(cerrados)) {
    if (q[campo] && !valores.includes(q[campo])) {
      errores.push({ campo, mensaje: `Debe ser uno de: ${valores.join(', ')}` });
    }
  }
  if (q.q !== undefined && String(q.q).length > 100) errores.push({ campo: 'q', mensaje: 'Máximo 100 caracteres' });

  const entero = (v, min, max) => /^\d+$/.test(v) && Number(v) >= min && Number(v) <= max;
  if (q.pagina !== undefined && !entero(q.pagina, 1, 100000)) errores.push({ campo: 'pagina', mensaje: 'Debe ser un entero >= 1' });
  if (q.limite !== undefined && !entero(q.limite, 1, 100)) errores.push({ campo: 'limite', mensaje: 'Debe ser un entero entre 1 y 100' });
  if (q.orden !== undefined && !ORDENABLES.includes(q.orden)) errores.push({ campo: 'orden', mensaje: `Debe ser uno de: ${ORDENABLES.join(', ')}` });
  if (q.dir !== undefined && !['asc', 'desc'].includes(String(q.dir).toLowerCase())) errores.push({ campo: 'dir', mensaje: 'Debe ser asc o desc' });

  if (errores.length) return next(new AppError('Parámetros de consulta inválidos', 400, errores));
  next();
}

module.exports = { validarIncidente, validarId, validarFiltros, CAMPOS_PERMITIDOS };
