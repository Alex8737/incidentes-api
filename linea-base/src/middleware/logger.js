
const registros = [];
const MAX_REGISTROS = 50;

const colores = { 2: '\x1b[32m', 3: '\x1b[36m', 4: '\x1b[33m', 5: '\x1b[31m' };
const reset = '\x1b[0m';

function logger(req, res, next) {
  const inicio = process.hrtime.bigint();

  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
    const entrada = {
      fecha: new Date().toISOString(),
      metodo: req.method,
      url: req.originalUrl,
      estado: res.statusCode,
      duracionMs: Number(ms.toFixed(2)),
      ip: req.ip
    };

    registros.unshift(entrada);
    if (registros.length > MAX_REGISTROS) registros.pop();

    const color = colores[String(res.statusCode)[0]] || '';
    console.log(
      `[${entrada.fecha}] ${entrada.metodo.padEnd(6)} ${entrada.url} ` +
      `${color}${entrada.estado}${reset} - ${entrada.duracionMs} ms`
    );
  });

  next();
}

logger.getRegistros = () => registros;

module.exports = logger;
