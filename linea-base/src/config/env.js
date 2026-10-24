/**
 * CARGA Y VALIDACIÓN DE VARIABLES DE ENTORNO
 * - Lee el archivo .env (si existe) con dotenv.
 * - Valida variables obligatorias según el motor elegido y la seguridad JWT.
 * - Nunca imprime contraseñas ni secretos: si falta algo, solo dice el NOMBRE de la variable.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env'), quiet: true });

const MOTORES = ['sqlite', 'mysql', 'postgres'];

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 3000,
  CORS_ORIGIN: (process.env.CORS_ORIGIN || 'http://localhost:3000')
    .split(',').map(o => o.trim()).filter(Boolean),

  // Autenticación JWT
  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_EXPIRA: process.env.JWT_EXPIRA || '8h',

  DB_DIALECT: (process.env.DB_DIALECT || 'sqlite').toLowerCase(),
  DB_STORAGE: process.env.DB_STORAGE || 'database/incidentes.sqlite',
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
  DB_NAME: process.env.DB_NAME,
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_SSL: process.env.DB_SSL === 'true',
  DB_LOGGING: process.env.DB_LOGGING === 'true'
};

function validarEnv() {
  if (!MOTORES.includes(env.DB_DIALECT)) {
    throw new Error(`DB_DIALECT debe ser uno de: ${MOTORES.join(', ')}`);
  }
  if (env.DB_DIALECT !== 'sqlite') {
    const faltantes = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'].filter(k => !env[k]);
    if (faltantes.length) {
      throw new Error(`Faltan variables de entorno para ${env.DB_DIALECT}: ${faltantes.join(', ')}`);
    }
  }
  // El secreto JWT es obligatorio y debe ser suficientemente largo (no se usa un valor por defecto)
  if (env.JWT_SECRET.length < 32) {
    throw new Error('Falta JWT_SECRET en .env (mínimo 32 caracteres)');
  }
}

validarEnv();

module.exports = env;
