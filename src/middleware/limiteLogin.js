/**
 * LÍMITE DE INTENTOS DE INICIO DE SESIÓN (Reto 4: defensa contra fuerza bruta)
 * Cuenta los intentos FALLIDOS por IP en una ventana de tiempo. Al superar el máximo responde 429
 * con Retry-After. Un inicio de sesión correcto reinicia el contador de esa IP.
 * Es en memoria (una instancia). Con varias instancias habría que moverlo a Redis: ver "Limitaciones".
 */
const AppError = require('../utils/AppError');

function crearLimiteLogin({ max, ventanaMs, ahora = Date.now } = {}) {
  const intentos = new Map(); // ip -> { cuenta, desde }

  const vigente = ip => {
    const e = intentos.get(ip);
    if (e && ahora() - e.desde > ventanaMs) intentos.delete(ip);
    return intentos.get(ip);
  };

  function middleware(req, res, next) {
    const e = vigente(req.ip);
    if (e && e.cuenta >= max) {
      const espera = Math.ceil((e.desde + ventanaMs - ahora()) / 1000);
      res.setHeader('Retry-After', String(Math.max(espera, 1)));
      next(new AppError('Demasiados intentos fallidos. Intente de nuevo más tarde.', 429));
      return;
    }
    res.on('finish', () => {
      if (res.statusCode === 401) {
        const actual = vigente(req.ip) || { cuenta: 0, desde: ahora() };
        intentos.set(req.ip, { cuenta: actual.cuenta + 1, desde: actual.desde });
      } else if (res.statusCode < 400) {
        intentos.delete(req.ip);
      }
    });
    next();
  }

  middleware.reiniciar = () => intentos.clear();
  return middleware;
}

module.exports = crearLimiteLogin;
