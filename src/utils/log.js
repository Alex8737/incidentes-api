/**
 * REGISTRO CENTRAL DE EVENTOS (Reto 4: logs estructurados sin secretos)
 * - Formato "json" (producción): una línea JSON por evento, fácil de filtrar en el panel del proveedor.
 * - Formato "texto" (desarrollo): línea legible.
 * - Nunca recibe cuerpos de petición ni cabeceras: solo los campos que cada llamador decide enviar.
 * - Además redacta por seguridad cualquier campo cuyo nombre sugiera un secreto.
 */
const env = require('../config/env');

const CAMPOS_SECRETOS = /pass|secret|token|authorization|cookie|hash/i;

/** Copia el objeto reemplazando por "[oculto]" los campos con nombre sensible. */
function redactar(campos = {}) {
  return Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, CAMPOS_SECRETOS.test(k) ? '[oculto]' : v]));
}

/** Convierte un Error en datos seguros para el log del servidor (nunca va al cliente). */
function describirError(err) {
  if (!err) return undefined;
  return { errorNombre: err.name, errorMensaje: err.message, errorPila: env.ES_PRODUCCION ? undefined : err.stack };
}

function escribir(nivel, mensaje, campos) {
  const evento = { ts: new Date().toISOString(), nivel, mensaje, ...redactar(campos) };
  const salida = nivel === 'error' ? console.error : (nivel === 'warn' ? console.warn : console.log);
  if (env.LOG_FORMAT === 'json') {
    salida(JSON.stringify(evento));
    return;
  }
  const { ts, nivel: n, mensaje: m, ...resto } = evento;
  const extra = Object.keys(resto).length ? ` ${JSON.stringify(resto)}` : '';
  salida(`[${ts}] ${n.toUpperCase().padEnd(5)} ${m}${extra}`);
}

module.exports = {
  info: (mensaje, campos) => escribir('info', mensaje, campos),
  warn: (mensaje, campos) => escribir('warn', mensaje, campos),
  error: (mensaje, campos) => escribir('error', mensaje, campos),
  redactar,
  describirError
};
