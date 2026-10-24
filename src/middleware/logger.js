/**
 * REGISTRO DE SOLICITUDES Y MÉTRICAS (Reto 4: monitoreo)
 * Por cada petición guarda un evento con: fecha, id de solicitud, método, RUTA (sin parámetros de
 * consulta: pueden contener texto de búsqueda), estado, duración, IP y, si hubo sesión, id y rol.
 * NO guarda cabeceras (Authorization), cuerpos ni contraseñas.
 *
 *  - X-Request-Id: cada respuesta lleva un identificador que también aparece en el log del servidor
 *    y en los errores 5xx (campo "referencia"), así se une lo que ve la persona con lo que pasó.
 *  - Nivel: 5xx -> error, 4xx -> warn, resto -> info.
 *  - Métricas en memoria (últimas 500 peticiones): total, errores por clase, promedio y p95.
 */
const crypto = require('crypto');
const log = require('../utils/log');

const MAX_REGISTROS = 50;
const MAX_MUESTRAS = 500;
const ID_VALIDO = /^[A-Za-z0-9_-]{8,64}$/;

const registros = [];
const muestras = [];
const inicio = Date.now();
const conteo = { total: 0, '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };

function idDeSolicitud(req) {
  const entrante = req.headers['x-request-id'];
  return typeof entrante === 'string' && ID_VALIDO.test(entrante) ? entrante : crypto.randomUUID();
}

function nivelDe(estado) {
  if (estado >= 500) return 'error';
  return estado >= 400 ? 'warn' : 'info';
}

function acumular(estado, ms) {
  conteo.total += 1;
  const clase = `${String(estado)[0]}xx`;
  if (clase in conteo) conteo[clase] += 1;
  muestras.push(ms);
  if (muestras.length > MAX_MUESTRAS) muestras.shift();
}

function percentil(valores, p) {
  if (!valores.length) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  return ordenados[Math.min(ordenados.length - 1, Math.ceil((p / 100) * ordenados.length) - 1)];
}

function construirEvento(req, res, ms) {
  return {
    fecha: new Date().toISOString(),
    requestId: req.id,
    metodo: req.method,
    url: req.originalUrl.split('?')[0],
    estado: res.statusCode,
    duracionMs: Number(ms.toFixed(2)),
    ip: req.ip,
    ...(req.usuario ? { usuarioId: req.usuario.id, rol: req.usuario.rol } : {})
  };
}

function logger(req, res, next) {
  const t0 = process.hrtime.bigint();
  req.id = idDeSolicitud(req);
  res.setHeader('X-Request-Id', req.id);

  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    const evento = construirEvento(req, res, ms);
    registros.unshift(evento);
    if (registros.length > MAX_REGISTROS) registros.pop();
    acumular(evento.estado, ms);
    const campos = { ...evento };
    delete campos.fecha; // el log ya agrega su propio ts
    log[nivelDe(evento.estado)]('solicitud', campos);
  });

  next();
}

logger.getRegistros = () => registros;

/** Resumen para /api/metricas: disponibilidad, errores 5xx y latencia (ver Figura 4 de la guía). */
logger.getMetricas = () => ({
  desde: new Date(inicio).toISOString(),
  uptimeSeg: Math.round((Date.now() - inicio) / 1000),
  solicitudes: { ...conteo },
  disponibilidadPct: conteo.total ? Number((100 * (1 - conteo['5xx'] / conteo.total)).toFixed(2)) : 100,
  latenciaMs: {
    muestras: muestras.length,
    promedio: muestras.length ? Number((muestras.reduce((a, b) => a + b, 0) / muestras.length).toFixed(2)) : 0,
    p95: Number(percentil(muestras, 95).toFixed(2))
  }
});

module.exports = logger;
