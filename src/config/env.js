/**
 * CARGA Y VALIDACIÓN DE VARIABLES DE ENTORNO (Reto 4: configuración por entorno)
 * - Lee el archivo .env (solo en local; en producción las variables las define el proveedor).
 * - Valida las variables obligatorias según el motor y el entorno, y falla ANTES de aceptar tráfico.
 * - Nunca imprime contraseñas ni secretos: si falta algo, solo dice el NOMBRE de la variable.
 * - Acepta DATABASE_URL (formato de Render, Neon, Supabase…) además de las variables DB_* sueltas.
 *
 * La lógica está en cargarEnv(fuente) —una función pura— para poder probarla sin tocar process.env.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env'), quiet: true });
const { version } = require('../../package.json');

const MOTORES = ['sqlite', 'mysql', 'postgres'];
const PROTOCOLOS = { 'postgres:': 'postgres', 'postgresql:': 'postgres', 'mysql:': 'mysql' };
const SECRETO_EJEMPLO = 'cambie-este-secreto';

/** "true"/"false" -> booleano; vacío -> valor por defecto. */
const booleano = (valor, porDefecto) => (valor === undefined || valor === '' ? porDefecto : String(valor).toLowerCase() === 'true');

/** Separa una lista "a, b, c" en un arreglo sin vacíos. */
const lista = texto => (texto || '').split(',').map(o => o.trim()).filter(Boolean);

/** Convierte DATABASE_URL en las variables DB_* (sin imprimirla nunca). */
function leerDatabaseUrl(texto) {
  let url;
  try {
    url = new URL(texto);
  } catch {
    throw new Error('DATABASE_URL no es una URL válida');
  }
  const motor = PROTOCOLOS[url.protocol];
  if (!motor) throw new Error('DATABASE_URL debe empezar con postgres:// o mysql://');
  const ssl = ['require', 'verify-full', 'verify-ca'].includes(url.searchParams.get('sslmode'));
  return {
    DB_DIALECT: motor,
    DB_HOST: url.hostname,
    DB_PORT: url.port ? Number(url.port) : undefined,
    DB_NAME: decodeURIComponent(url.pathname.replace(/^\//, '')),
    DB_USER: decodeURIComponent(url.username),
    DB_PASSWORD: decodeURIComponent(url.password),
    ...(ssl ? { DB_SSL: true } : {})
  };
}

/** TRUST_PROXY: número de saltos de proxy a confiar. En producción (Render) hay 1; en local, ninguno. */
function leerTrustProxy(valor, esProduccion) {
  if (valor === undefined || valor === '') return esProduccion ? 1 : false;
  if (valor === 'true') return 1;
  if (valor === 'false') return false;
  return Number.isInteger(Number(valor)) ? Number(valor) : false;
}

/** Base de datos: DATABASE_URL tiene prioridad sobre las variables sueltas. */
function leerBaseDeDatos(f) {
  const desdeUrl = f.DATABASE_URL ? leerDatabaseUrl(f.DATABASE_URL) : {};
  const base = {
    DB_DIALECT: (f.DB_DIALECT || 'sqlite').toLowerCase(),
    DB_STORAGE: f.DB_STORAGE || 'database/incidentes.sqlite',
    DB_HOST: f.DB_HOST,
    DB_PORT: f.DB_PORT ? Number(f.DB_PORT) : undefined,
    DB_NAME: f.DB_NAME,
    DB_USER: f.DB_USER,
    DB_PASSWORD: f.DB_PASSWORD,
    DB_SSL: booleano(f.DB_SSL, false),
    DB_LOGGING: booleano(f.DB_LOGGING, false)
  };
  return { ...base, ...desdeUrl, DB_SSL: desdeUrl.DB_SSL || base.DB_SSL };
}

/** Valores que dependen del entorno (producción o no): HTTPS, proxy, CORS y logs. */
function leerEntorno(f, nodeEnv) {
  const esProduccion = nodeEnv === 'production';
  return {
    FORCE_HTTPS: booleano(f.FORCE_HTTPS, esProduccion),
    TRUST_PROXY: leerTrustProxy(f.TRUST_PROXY, esProduccion),
    LOG_FORMAT: f.LOG_FORMAT || (esProduccion ? 'json' : 'texto'),
    // En producción no se permite ningún origen externo salvo que se declare de forma explícita.
    CORS_ORIGIN: lista(f.CORS_ORIGIN !== undefined ? f.CORS_ORIGIN : (esProduccion ? '' : 'http://localhost:3000'))
  };
}

/** Lee todas las variables sin validarlas todavía. */
function leer(f) {
  const nodeEnv = f.NODE_ENV || 'development';
  return {
    NODE_ENV: nodeEnv,
    ES_PRODUCCION: nodeEnv === 'production',
    PORT: Number(f.PORT) || 3000,
    APP_VERSION: version,
    COMMIT: (f.RENDER_GIT_COMMIT || f.GIT_COMMIT || '').slice(0, 7),
    ...leerEntorno(f, nodeEnv),
    LOGIN_MAX_INTENTOS: Number(f.LOGIN_MAX_INTENTOS) || (nodeEnv === 'test' ? 10000 : 10),
    LOGIN_VENTANA_MIN: Number(f.LOGIN_VENTANA_MIN) || 15,
    JWT_SECRET: f.JWT_SECRET || '',
    JWT_EXPIRA: f.JWT_EXPIRA || '8h',
    ...leerBaseDeDatos(f)
  };
}

/** Devuelve la lista de errores de configuración (vacía si todo está bien). */
function validar(env) {
  const errores = [];
  if (!MOTORES.includes(env.DB_DIALECT)) errores.push(`DB_DIALECT debe ser uno de: ${MOTORES.join(', ')}`);
  if (MOTORES.includes(env.DB_DIALECT) && env.DB_DIALECT !== 'sqlite') {
    const faltantes = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'].filter(k => !env[k]);
    if (faltantes.length) errores.push(`Faltan variables de entorno para ${env.DB_DIALECT}: ${faltantes.join(', ')} (o defina DATABASE_URL)`);
  }
  // El secreto JWT es obligatorio y debe ser suficientemente largo (no se usa un valor por defecto)
  if (env.JWT_SECRET.length < 32) errores.push('Falta JWT_SECRET (mínimo 32 caracteres)');
  if (env.ES_PRODUCCION) errores.push(...validarProduccion(env));
  return errores;
}

/** Reglas extra que solo aplican cuando NODE_ENV=production. */
function validarProduccion(env) {
  const errores = [];
  if (env.JWT_SECRET.startsWith(SECRETO_EJEMPLO)) errores.push('JWT_SECRET sigue siendo el valor de ejemplo; genere uno aleatorio');
  const inseguros = env.CORS_ORIGIN.filter(o => !o.startsWith('https://'));
  if (inseguros.length) errores.push('CORS_ORIGIN solo admite orígenes https:// en producción');
  return errores;
}

/** Avisos que no detienen el arranque pero deben quedar en el log. */
function advertencias(env) {
  const avisos = [];
  if (env.ES_PRODUCCION && env.DB_DIALECT === 'sqlite') {
    avisos.push('SQLite en producción: los datos se pierden al redesplegar si no hay un disco persistente. Use DATABASE_URL (PostgreSQL).');
  }
  if (env.ES_PRODUCCION && !env.FORCE_HTTPS) avisos.push('FORCE_HTTPS está desactivado en producción');
  return avisos;
}

/** Punto de entrada puro: lee, valida y devuelve la configuración (o lanza con TODOS los problemas). */
function cargarEnv(fuente = process.env) {
  const env = leer(fuente);
  const errores = validar(env);
  if (errores.length) throw new Error(errores.join(' | '));
  return { ...env, ADVERTENCIAS: advertencias(env) };
}

const env = cargarEnv(process.env);
// Disponible para las pruebas unitarias, sin aparecer al recorrer la configuración.
Object.defineProperty(env, 'cargarEnv', { value: cargarEnv, enumerable: false });

module.exports = env;
