/**
 * PRUEBAS DE PRODUCCIÓN (Reto 4): salud, trazabilidad, logs sin secretos, métricas y HTTPS.
 * Se ejecutan contra SQLite en memoria con las mismas migraciones que el servicio real.
 */
const express = require('express');
const request = require('supertest');

const { sequelize, Incidente, migrar, reiniciarDatos, api, CUENTAS_PRUEBA } = require('../helpers');
const app = require('../../src/app');
const forzarHttps = require('../../src/middleware/forzarHttps');
const log = require('../../src/utils/log');
const { version } = require('../../package.json');

beforeAll(migrar);
beforeEach(reiniciarDatos);
afterAll(() => sequelize.close());
afterEach(() => jest.restoreAllMocks());

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('Health check', () => {
  it('200 con servicio, versión del código, entorno y base conectada', async () => {
    const res = await request(app).get('/api/health').expect(200);
    expect(res.body).toMatchObject({ ok: true, servicio: 'API de Incidentes', version, entorno: 'test' });
    expect(res.body.baseDeDatos).toEqual({ motor: 'sqlite', conectada: true });
    expect(res.body.fecha).toBeTruthy();
  });

  it('503 si la base no responde, SIN exponer host, usuario ni mensaje interno', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(sequelize, 'authenticate').mockRejectedValueOnce(new Error('connect ECONNREFUSED db-privada.interno:5432 usuario=app_prod'));
    const res = await request(app).get('/api/health').expect(503);
    expect(res.body.ok).toBe(false);
    expect(res.body.baseDeDatos.conectada).toBe(false);
    expect(JSON.stringify(res.body)).not.toMatch(/db-privada|app_prod|ECONNREFUSED/);
  });

  it('se puede consultar sin sesión (lo usa el balanceador)', async () => {
    await request(app).get('/api/health').expect(200);
  });
});

describe('Trazabilidad: X-Request-Id', () => {
  it('toda respuesta lleva un identificador único', async () => {
    const a = await request(app).get('/api/health');
    const b = await request(app).get('/api/health');
    expect(a.headers['x-request-id']).toMatch(UUID);
    expect(a.headers['x-request-id']).not.toBe(b.headers['x-request-id']);
  });

  it('se conserva el identificador entrante si tiene formato válido', async () => {
    const res = await request(app).get('/api/health').set('X-Request-Id', 'traza-cliente-12345');
    expect(res.headers['x-request-id']).toBe('traza-cliente-12345');
  });

  it('se descarta un identificador entrante malicioso o demasiado largo', async () => {
    const malo = await request(app).get('/api/health').set('X-Request-Id', 'a b<script>');
    expect(malo.headers['x-request-id']).toMatch(UUID);
    const largo = await request(app).get('/api/health').set('X-Request-Id', 'a'.repeat(200));
    expect(largo.headers['x-request-id']).toMatch(UUID);
  });

  it('el error 500 devuelve como "referencia" el mismo id de la cabecera (une pantalla y log)', async () => {
    jest.spyOn(Incidente, 'findByPk').mockRejectedValueOnce(new Error('fallo interno con detalles'));
    const res = await api(app).get('/api/incidentes/1').expect(500);
    expect(res.body.error.referencia).toBe(res.headers['x-request-id']);
    expect(JSON.stringify(res.body)).not.toMatch(/detalles/);
  });
});

describe('Logs sin secretos y métricas (solo administradores)', () => {
  it('el log no guarda contraseñas, tokens ni el texto de las búsquedas', async () => {
    const c = CUENTAS_PRUEBA.find(x => x.rol === 'admin');
    await request(app).post('/api/auth/login').send({ usuario: c.usuario, password: c.clave }).expect(200);
    await api(app).get('/api/incidentes?q=busquedaConfidencial').expect(200);
    const res = await api(app, 'admin').get('/api/logs').expect(200);
    const texto = JSON.stringify(res.body);
    expect(texto).not.toContain(c.clave);
    expect(texto).not.toContain('busquedaConfidencial');
    expect(texto).not.toMatch(/Bearer|authorization/i);
    expect(res.body.datos[0]).toEqual(expect.objectContaining({ requestId: expect.any(String), metodo: 'GET', estado: expect.any(Number) }));
  });

  it('las entradas del log identifican al usuario (id y rol) cuando hubo sesión', async () => {
    await api(app, 'analista').get('/api/incidentes').expect(200);
    const res = await api(app, 'admin').get('/api/logs').expect(200);
    const entrada = res.body.datos.find(e => e.url === '/api/incidentes');
    expect(entrada).toMatchObject({ rol: 'analista' });
    expect(entrada.usuarioId).toBeDefined();
  });

  it('/api/metricas devuelve solicitudes, disponibilidad y latencia p95', async () => {
    await request(app).get('/api/health');
    const res = await api(app, 'admin').get('/api/metricas').expect(200);
    const m = res.body.datos;
    expect(m.solicitudes.total).toBeGreaterThan(0);
    expect(m.solicitudes).toEqual(expect.objectContaining({ '2xx': expect.any(Number), '4xx': expect.any(Number), '5xx': expect.any(Number) }));
    expect(m.disponibilidadPct).toBeLessThanOrEqual(100);
    expect(m.latenciaMs.p95).toBeGreaterThanOrEqual(0);
    expect(typeof m.latenciaMs.promedio).toBe('number');
  });

  it('analista y visor no ven métricas; sin sesión → 401', async () => {
    await request(app).get('/api/metricas').expect(401);
    await api(app, 'analista').get('/api/metricas').expect(403);
    await api(app, 'visor').get('/api/metricas').expect(403);
  });
});

describe('Registro estructurado (utils/log)', () => {
  it('redacta campos cuyo nombre sugiere un secreto', () => {
    const limpio = log.redactar({ usuario: 'ana', password: 'x', Authorization: 'Bearer abc', jwtToken: 't', passwordHash: 'h', ruta: '/api' });
    expect(limpio).toEqual({ usuario: 'ana', password: '[oculto]', Authorization: '[oculto]', jwtToken: '[oculto]', passwordHash: '[oculto]', ruta: '/api' });
  });

  it('describirError devuelve nombre y mensaje (la pila solo fuera de producción)', () => {
    const d = log.describirError(new TypeError('falló'));
    expect(d).toMatchObject({ errorNombre: 'TypeError', errorMensaje: 'falló' });
    expect(log.describirError(null)).toBeUndefined();
  });
});

describe('Redirección a HTTPS', () => {
  const appCon = opciones => {
    const a = express();
    a.set('trust proxy', 1);
    a.use(forzarHttps(opciones));
    a.all('*', (req, res) => res.json({ ok: true, ruta: req.path }));
    return a;
  };

  it('GET por HTTP → 308 hacia la misma ruta en https://, conservando la consulta', async () => {
    const res = await request(appCon({ activo: true })).get('/api/incidentes?estado=abierto').set('Host', 'plataforma.example').expect(308);
    expect(res.headers.location).toBe('https://plataforma.example/api/incidentes?estado=abierto');
  });

  it('detrás del proxy con X-Forwarded-Proto: https la petición pasa', async () => {
    await request(appCon({ activo: true })).get('/api/incidentes').set('X-Forwarded-Proto', 'https').expect(200);
  });

  it('POST por HTTP → 403 (nunca se reenvían credenciales por HTTP)', async () => {
    const res = await request(appCon({ activo: true })).post('/api/auth/login').send({ usuario: 'a', password: 'b' }).expect(403);
    expect(res.body.error.mensaje).toMatch(/HTTPS/);
  });

  it('/api/health queda exento para el health check interno del balanceador', async () => {
    await request(appCon({ activo: true, excepto: ['/api/health'] })).get('/api/health').expect(200);
  });

  it('desactivado (desarrollo): no redirige', async () => {
    await request(appCon({ activo: false })).get('/algo').expect(200);
  });
});

describe('Persistencia: lo creado sigue ahí tras "reiniciar" la capa de datos', () => {
  it('un incidente creado por la API se lee de nuevo directamente desde la base', async () => {
    const nuevo = { titulo: 'Incidente que debe persistir', descripcion: 'Prueba de persistencia', categoria: 'otro', severidad: 'media', prioridad: 'media' };
    const creado = await api(app).post('/api/incidentes').send(nuevo).expect(201);
    const enBase = await Incidente.findByPk(creado.body.datos.id);
    expect(enBase.titulo).toBe(nuevo.titulo);
    const otraVez = await api(app).get(`/api/incidentes/${creado.body.datos.id}`).expect(200);
    expect(otraVez.body.datos.titulo).toBe(nuevo.titulo);
  });
});
