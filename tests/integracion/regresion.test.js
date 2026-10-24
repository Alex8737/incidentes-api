/**
 * PRUEBAS DE REGRESIÓN (Reto 3 - Unidad 7)
 * Cada prueba reproduce un defecto encontrado con DevTools o con las mediciones,
 * para garantizar que no vuelva a aparecer. Base SQLite en memoria con migraciones.
 */
const request = require('supertest');
const { sequelize, Incidente, migrar, reiniciarDatos, api } = require('../helpers');
const app = require('../../src/app');

beforeAll(migrar);
beforeEach(reiniciarDatos);
afterAll(() => sequelize.close());

const incidente = (titulo, extra = {}) => ({ titulo, descripcion: '', categoria: 'otro', severidad: 'media', ...extra });

describe('Defecto 1: contador y paginación', () => {
  it('la API informa el total real y el número de páginas aunque solo envíe 50 registros', async () => {
    await Incidente.bulkCreate(Array.from({ length: 60 }, (_, i) => incidente(`Incidente de carga ${i + 1}`)));
    const p1 = await api(app).get('/api/incidentes').expect(200);
    expect(p1.body.total).toBe(64);         // 4 fixtures + 60
    expect(p1.body.datos).toHaveLength(50); // página llena
    expect(p1.body.paginas).toBe(2);

    const p2 = await api(app).get('/api/incidentes?pagina=2').expect(200);
    expect(p2.body.datos).toHaveLength(14);
    const ids1 = new Set(p1.body.datos.map(i => i.id));
    expect(p2.body.datos.some(i => ids1.has(i.id))).toBe(false); // sin repetidos entre páginas
  });
});

describe('Defecto 3: el servidor informa los permisos de cada rol', () => {
  it.each([
    ['admin', ['leer', 'escribir', 'eliminar', 'verLogs']],
    ['analista', ['leer', 'escribir']],
    ['visor', ['leer']]
  ])('GET /api/auth/me para %s devuelve %j', async (rol, permisos) => {
    const res = await api(app, rol).get('/api/auth/me').expect(200);
    expect(res.body.datos.permisos).toEqual(permisos);
  });

  it('el login también devuelve los permisos (el front ya no los adivina)', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ usuario: 'analista_test', password: 'ClaveAnalista-123' }).expect(200);
    expect(res.body.datos.permisos).toEqual(['leer', 'escribir']);
    expect(res.body.datos.passwordHash).toBeUndefined();
  });
});

describe('Defecto 4: búsqueda con comodines % y _ en SQLite', () => {
  beforeEach(async () => {
    await Incidente.bulkCreate([
      incidente('Caída del servidor SRV_WEB_01'),
      incidente('Revisión del equipo SRVXWEB'),      // NO debe coincidir con "SRV_WEB"
      incidente('Uso de CPU al 100% en SRV_DB_02'),
      incidente('Uso de CPU al 1000 en pruebas')     // NO debe coincidir con "100%"
    ]);
  });

  it('"SRV_WEB" encuentra el texto literal (el _ no es comodín)', async () => {
    const res = await api(app).get('/api/incidentes?q=SRV_WEB').expect(200);
    expect(res.body.datos.map(i => i.titulo)).toEqual(['Caída del servidor SRV_WEB_01']);
  });

  it('"100%" encuentra el texto literal (el % no es comodín)', async () => {
    const res = await api(app).get(`/api/incidentes?q=${encodeURIComponent('100%')}`).expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.datos[0].titulo).toMatch('100%');
  });

  it('el carácter de escape y las comillas se tratan como texto (sin error ni inyección)', async () => {
    for (const q of ['!', "'", "'; DROP TABLE incidentes; --"]) {
      const res = await api(app).get(`/api/incidentes?q=${encodeURIComponent(q)}`).expect(200);
      expect(res.body.total).toBe(0);
    }
    expect(await Incidente.count()).toBe(8);
  });
});

describe('Optimización de red e imágenes', () => {
  it('comprime con gzip las respuestas JSON grandes', async () => {
    await Incidente.bulkCreate(Array.from({ length: 20 }, (_, i) => incidente(`Incidente para compresión ${i}`)));
    const res = await api(app).get('/api/incidentes').set('Accept-Encoding', 'gzip').expect(200);
    expect(res.headers['content-encoding']).toBe('gzip');
    expect(res.headers.vary).toMatch(/Accept-Encoding/i);
  });

  it('no comprime respuestas pequeñas (menos de 1 kB)', async () => {
    const res = await request(app).get('/api/health').set('Accept-Encoding', 'gzip').expect(200);
    expect(res.headers['content-encoding']).toBeUndefined();
  });

  it('sirve el favicon y el logo optimizado con caché del navegador', async () => {
    for (const ruta of ['/img/favicon-32.png', '/img/logo-80.webp']) {
      const res = await request(app).get(ruta).expect(200);
      expect(res.headers['cache-control']).toBe('public, max-age=604800');
    }
  });
});

describe('Optimización de consultas', () => {
  it('las estadísticas se calculan con UNA sola consulta SQL (antes eran 4)', async () => {
    const sentencias = [];
    const original = sequelize.options.logging;
    sequelize.options.logging = sql => sentencias.push(sql);
    try {
      const res = await api(app).get('/api/incidentes/stats').expect(200);
      expect(res.body.datos.total).toBe(4);
    } finally {
      sequelize.options.logging = original;
    }
    const deEstadisticas = sentencias.filter(s => /GROUP BY|COUNT\(/i.test(s));
    expect(deEstadisticas).toHaveLength(1);
  });
});
