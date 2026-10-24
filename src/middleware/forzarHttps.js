/**
 * REDIRECCIÓN A HTTPS (Reto 4)
 * Detrás de un proxy (Render, Vercel, Nginx) la conexión con Node es HTTP, pero el navegador habló HTTPS.
 * Con "trust proxy" activo, Express lee X-Forwarded-Proto y deja el resultado en req.secure.
 *  - Si NO es seguro: GET/HEAD -> 308 a la misma ruta en https://; otros métodos -> 403 (nunca se
 *    reenvía un POST con credenciales por HTTP).
 *  - Se exceptúan las rutas indicadas (p. ej. /api/health: el balanceador consulta por HTTP interno).
 */
function forzarHttps({ activo, excepto = [] } = {}) {
  return (req, res, next) => {
    if (!activo || req.secure || excepto.includes(req.path)) {
      next();
      return;
    }
    if (req.method === 'GET' || req.method === 'HEAD') {
      res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
      return;
    }
    res.status(403).json({ ok: false, error: { mensaje: 'Use HTTPS para acceder a este servicio', estado: 403 } });
  };
}

module.exports = forzarHttps;
