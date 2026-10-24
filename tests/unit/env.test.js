/**
 * PRUEBAS DE LA CONFIGURACIÓN POR ENTORNO (Reto 4)
 * Se prueba la función pura cargarEnv(fuente) con objetos simples: no se toca process.env real
 * ni el archivo .env de quien ejecuta las pruebas.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'secreto-solo-para-pruebas-de-la-plataforma-0123456789';

const { cargarEnv } = require('../../src/config/env');

const SECRETO = 'x'.repeat(40);
const base = (extra = {}) => ({ JWT_SECRET: SECRETO, ...extra });
const produccion = (extra = {}) => base({ NODE_ENV: 'production', DATABASE_URL: 'postgres://u:p@h:5432/d', ...extra });

describe('Valores por defecto según el entorno', () => {
  it('desarrollo: puerto 3000, CORS local, sin HTTPS forzado y logs en texto', () => {
    const env = cargarEnv(base());
    expect(env.PORT).toBe(3000);
    expect(env.CORS_ORIGIN).toEqual(['http://localhost:3000']);
    expect(env.FORCE_HTTPS).toBe(false);
    expect(env.TRUST_PROXY).toBe(false);
    expect(env.LOG_FORMAT).toBe('texto');
    expect(env.DB_DIALECT).toBe('sqlite');
  });

  it('producción: HTTPS forzado, confía en 1 proxy, logs JSON y ningún origen CORS por defecto', () => {
    const env = cargarEnv(produccion());
    expect(env.FORCE_HTTPS).toBe(true);
    expect(env.TRUST_PROXY).toBe(1);
    expect(env.LOG_FORMAT).toBe('json');
    expect(env.CORS_ORIGIN).toEqual([]);
  });

  it('usa el PORT que entrega el proveedor', () => {
    expect(cargarEnv(base({ PORT: '10000' })).PORT).toBe(10000);
  });

  it('las variables explícitas mandan sobre los valores por defecto', () => {
    const env = cargarEnv(produccion({ FORCE_HTTPS: 'false', LOG_FORMAT: 'texto', TRUST_PROXY: '2' }));
    expect(env.FORCE_HTTPS).toBe(false);
    expect(env.LOG_FORMAT).toBe('texto');
    expect(env.TRUST_PROXY).toBe(2);
  });
});

describe('Variables obligatorias: el servicio no arranca sin ellas', () => {
  it('falta JWT_SECRET → error que nombra la variable', () => {
    expect(() => cargarEnv({})).toThrow(/JWT_SECRET/);
  });

  it('JWT_SECRET demasiado corto → error', () => {
    expect(() => cargarEnv({ JWT_SECRET: 'corto' })).toThrow(/JWT_SECRET/);
  });

  it('producción rechaza el secreto de ejemplo del .env.example', () => {
    const ejemplo = 'cambie-este-secreto-por-uno-largo-y-aleatorio-32+';
    expect(() => cargarEnv(produccion({ JWT_SECRET: ejemplo }))).toThrow(/valor de ejemplo/);
  });

  it('producción rechaza orígenes CORS que no sean https://', () => {
    expect(() => cargarEnv(produccion({ CORS_ORIGIN: 'http://sitio.example' }))).toThrow(/CORS_ORIGIN/);
    expect(cargarEnv(produccion({ CORS_ORIGIN: 'https://sitio.example' })).CORS_ORIGIN).toEqual(['https://sitio.example']);
  });

  it('motor desconocido → error', () => {
    expect(() => cargarEnv(base({ DB_DIALECT: 'oracle' }))).toThrow(/DB_DIALECT/);
  });

  it('MySQL/PostgreSQL sin host/usuario/clave → el mensaje lista los NOMBRES faltantes, no valores', () => {
    let mensaje = '';
    try { cargarEnv(base({ DB_DIALECT: 'postgres', DB_NAME: 'bd' })); } catch (e) { mensaje = e.message; }
    expect(mensaje).toMatch(/DB_HOST/);
    expect(mensaje).toMatch(/DB_USER/);
    expect(mensaje).toMatch(/DB_PASSWORD/);
    expect(mensaje).not.toMatch(/DB_NAME,/); // DB_NAME sí estaba definida
  });

  it('el mensaje de error nunca contiene el secreto ni la clave de la base', () => {
    let mensaje = '';
    try { cargarEnv({ JWT_SECRET: 'corto-secreto', DB_DIALECT: 'mysql', DB_PASSWORD: 'ClaveSuperSecreta' }); } catch (e) { mensaje = e.message; }
    expect(mensaje).not.toMatch(/corto-secreto/);
    expect(mensaje).not.toMatch(/ClaveSuperSecreta/);
  });
});

describe('DATABASE_URL (formato de Render, Neon, Supabase…)', () => {
  it('se descompone en las variables DB_*', () => {
    const env = cargarEnv(base({ DATABASE_URL: 'postgres://app:clave@db.interno:5432/incidentes' }));
    expect(env).toMatchObject({ DB_DIALECT: 'postgres', DB_HOST: 'db.interno', DB_PORT: 5432, DB_NAME: 'incidentes', DB_USER: 'app', DB_PASSWORD: 'clave' });
  });

  it('decodifica caracteres especiales de la contraseña', () => {
    expect(cargarEnv(base({ DATABASE_URL: 'postgres://app:p%40ss%2Fx@h/d' })).DB_PASSWORD).toBe('p@ss/x');
  });

  it('sslmode=require activa DB_SSL', () => {
    expect(cargarEnv(base({ DATABASE_URL: 'postgres://a:b@h/d?sslmode=require' })).DB_SSL).toBe(true);
    expect(cargarEnv(base({ DATABASE_URL: 'postgres://a:b@h/d' })).DB_SSL).toBe(false);
  });

  it('una URL inválida da un error que NO repite la URL', () => {
    let mensaje = '';
    try { cargarEnv(base({ DATABASE_URL: 'esto-con-clave-123 no es url' })); } catch (e) { mensaje = e.message; }
    expect(mensaje).toMatch(/DATABASE_URL/);
    expect(mensaje).not.toMatch(/clave-123/);
  });

  it('un protocolo no soportado se rechaza', () => {
    expect(() => cargarEnv(base({ DATABASE_URL: 'mongodb://h/d' }))).toThrow(/postgres:\/\/ o mysql:\/\//);
  });
});

describe('Advertencias (no detienen el arranque)', () => {
  it('SQLite en producción avisa que los datos pueden perderse', () => {
    const env = cargarEnv(base({ NODE_ENV: 'production' }));
    expect(env.ADVERTENCIAS.join(' ')).toMatch(/SQLite en producción/);
  });

  it('PostgreSQL en producción no genera advertencias', () => {
    expect(cargarEnv(produccion()).ADVERTENCIAS).toEqual([]);
  });
});
