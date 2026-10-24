/**
 * PRUEBAS DE INTEGRACIÓN de la API contra una base real (SQLite en memoria + migraciones).
 * Cubre casos correctos (CRUD persistente, filtros, paginación) y casos de error
 * (validaciones, 404, JSON mal formado, fallas de base de datos sin filtrar detalles).
 */
const { ConnectionError } = require('sequelize');

const { sequelize, Incidente, migrar, reiniciarDatos, api } = require('../helpers');
const app = require('../../src/app');

const nuevoValido = {
  titulo: 'Escaneo de puertos desde IP externa',
  descripcion: 'El IDS detectó un escaneo Nmap sobre la DMZ.',
  categoria: 'acceso_no_autorizado',
  severidad: 'media',
  prioridad: 'alta',
  reportadoPor: 'IDS'
};

beforeAll(migrar);
beforeEach(reiniciarDatos);
afterAll(() => sequelize.close());

const unId = async () => (await Incidente.findOne({ order: [['id', 'ASC']] })).id;

// ------------------------------------------------------------------ CASOS CORRECTOS
describe('Casos correctos', () => {
  it('GET /api/health confirma conexión con la base', async () => {
    const res = await api(app).get('/api/health').expect(200);
    expect(res.body.baseDeDatos.conectada).toBe(true);
    expect(res.body.baseDeDatos.motor).toBe('sqlite');
  });

  it('POST crea y PERSISTE el incidente en la base (201 + Location)', async () => {
    const res = await api(app).post('/api/incidentes').send(nuevoValido).expect(201);
    expect(res.headers.location).toMatch(/^\/api\/incidentes\/\d+$/);
    expect(res.body.datos.estado).toBe('abierto');            // valor por defecto
    expect(res.body.datos.prioridad).toBe('alta');

    // Se verifica directamente en la tabla, no en la respuesta
    const enBase = await Incidente.findByPk(res.body.datos.id);
    expect(enBase).toBeTruthy(); // el registro debe existir en la base
    expect(enBase.titulo).toBe(nuevoValido.titulo);
    const [filas] = await sequelize.query('SELECT reportado_por FROM incidentes WHERE id = ?', { replacements: [enBase.id] });
    expect(filas[0].reportado_por).toBe('IDS');
  });

  it('GET /api/incidentes lista con total y paginación', async () => {
    const res = await api(app).get('/api/incidentes').expect(200);
    expect(res.body.total).toBe(4);
    expect(res.body.datos.length).toBe(4);
    expect(res.body.pagina).toBe(1);
  });

  it('filtra por estado', async () => {
    const res = await api(app).get('/api/incidentes?estado=abierto').expect(200);
    expect(res.body.total).toBe(2);
    expect(res.body.datos.every(i => i.estado === 'abierto')).toBeTruthy();
  });

  it('filtra por prioridad', async () => {
    const res = await api(app).get('/api/incidentes?prioridad=alta').expect(200);
    expect(res.body.total).toBe(2);
    expect(res.body.datos.every(i => i.prioridad === 'alta')).toBeTruthy();
  });

  it('combina estado + prioridad', async () => {
    const res = await api(app).get('/api/incidentes?estado=abierto&prioridad=alta').expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.datos[0].titulo).toBe('Phishing a contabilidad');
  });

  it('busca por texto (q) con consulta parametrizada', async () => {
    const res = await api(app).get('/api/incidentes?q=vpn').expect(200);
    expect(res.body.total).toBe(1);
    // Un intento de inyección SQL se trata como texto literal
    const inj = await api(app).get(`/api/incidentes?q=${encodeURIComponent("' OR 1=1 --")}`).expect(200);
    expect(inj.body.total).toBe(0);
    expect(await Incidente.count()).toBe(4);
  });

  it('pagina y ordena por prioridad (orden lógico, no alfabético)', async () => {
    const res = await api(app).get('/api/incidentes?orden=prioridad&dir=desc&limite=2&pagina=1').expect(200);
    expect(res.body.datos.length).toBe(2);
    expect(res.body.paginas).toBe(2);
    expect(res.body.datos[0].prioridad).toBe('urgente');
  });

  it('GET /:id obtiene un incidente', async () => {
    const id = await unId();
    const res = await api(app).get(`/api/incidentes/${id}`).expect(200);
    expect(res.body.datos.id).toBe(id);
  });

  it('PUT reemplaza el incidente completo y lo guarda', async () => {
    const id = await unId();
    await api(app).put(`/api/incidentes/${id}`)
      .send({ titulo: 'Phishing contenido y bloqueado', severidad: 'alta', estado: 'resuelto' })
      .expect(200);
    const enBase = await Incidente.findByPk(id);
    expect(enBase.estado).toBe('resuelto');
    expect(enBase.prioridad).toBe('media');      // campo no enviado vuelve al valor por defecto
    expect(enBase.descripcion).toBe('');
  });

  it('PATCH actualiza solo el estado y la fecha de actualización', async () => {
    const id = await unId();
    const antes = await Incidente.findByPk(id);
    await new Promise(r => setTimeout(r, 15));
    const res = await api(app).patch(`/api/incidentes/${id}`).send({ estado: 'cerrado' }).expect(200);
    expect(res.body.datos.estado).toBe('cerrado');
    expect(res.body.datos.titulo).toBe(antes.titulo);
    const despues = await Incidente.findByPk(id);
    expect(despues.fechaActualizacion > antes.fechaActualizacion).toBeTruthy();
  });

  it('DELETE elimina de la base (204) y luego responde 404', async () => {
    const id = await unId();
    await api(app).delete(`/api/incidentes/${id}`).expect(204);
    expect(await Incidente.findByPk(id)).toBe(null);
    await api(app).get(`/api/incidentes/${id}`).expect(404);
  });

  it('GET /stats calcula totales con GROUP BY', async () => {
    const res = await api(app).get('/api/incidentes/stats').expect(200);
    expect(res.body.datos.total).toBe(4);
    expect(res.body.datos.porEstado.abierto).toBe(2);
    expect(res.body.datos.porPrioridad.urgente).toBe(1);
    expect(res.body.datos.porSeveridad.critica).toBe(1);
  });

  it('GET /catalogos incluye prioridades', async () => {
    const res = await api(app).get('/api/incidentes/catalogos').expect(200);
    expect(res.body.datos.prioridades).toEqual(['baja', 'media', 'alta', 'urgente']);
  });
});

// ------------------------------------------------------------------ CASOS DE ERROR
describe('Casos de error y validaciones', () => {
  it('400 si el body tiene campos inválidos (con detalle por campo)', async () => {
    const res = await api(app).post('/api/incidentes')
      .send({ titulo: 'abc', severidad: 'extrema', prioridad: 'ya' }).expect(400);
    expect(res.body.ok).toBe(false);
    const campos = res.body.error.detalles.map(d => d.campo).sort();
    expect(campos).toEqual(['prioridad', 'severidad', 'titulo']);
    expect(await Incidente.count()).toBe(4); // no debe insertarse nada
  });

  it('400 si se intenta asignar campos no permitidos (id, fechas)', async () => {
    const res = await api(app).post('/api/incidentes')
      .send({ ...nuevoValido, id: 999, fechaCreacion: '2000-01-01' }).expect(400);
    const campos = res.body.error.detalles.map(d => d.campo);
    expect(campos.includes('id') && campos.includes('fechaCreacion')).toBeTruthy();
  });

  it('400 si el JSON está mal formado', async () => {
    const res = await api(app).post('/api/incidentes')
      .set('Content-Type', 'application/json').send('{"titulo": "x",').expect(400);
    expect(res.body.error.mensaje).toMatch(/JSON/);
  });

  it('413 si el cuerpo supera 10 KB', async () => {
    await api(app).post('/api/incidentes')
      .send({ ...nuevoValido, descripcion: 'x'.repeat(12000) }).expect(413);
  });

  it('400 si :id no es numérico', async () => {
    await api(app).get('/api/incidentes/abc').expect(400);
    await api(app).delete('/api/incidentes/-1').expect(400);
  });

  it('404 si el incidente no existe (GET, PUT, PATCH, DELETE)', async () => {
    await api(app).get('/api/incidentes/999999').expect(404);
    await api(app).put('/api/incidentes/999999').send(nuevoValido).expect(404);
    await api(app).patch('/api/incidentes/999999').send({ estado: 'cerrado' }).expect(404);
    await api(app).delete('/api/incidentes/999999').expect(404);
  });

  it('400 si PATCH llega vacío', async () => {
    const id = await unId();
    await api(app).patch(`/api/incidentes/${id}`).send({}).expect(400);
  });

  it('400 si un filtro tiene un valor fuera de catálogo o no soportado', async () => {
    const r1 = await api(app).get('/api/incidentes?estado=borrado').expect(400);
    expect(r1.body.error.detalles[0].campo).toBe('estado');
    await api(app).get('/api/incidentes?prioridad=maxima').expect(400);
    await api(app).get('/api/incidentes?limite=1000').expect(400);
    await api(app).get('/api/incidentes?orden=password').expect(400);
    await api(app).get('/api/incidentes?usuario=admin').expect(400);
  });

  it('404 para rutas /api inexistentes', async () => {
    await api(app).get('/api/no-existe').expect(404);
  });

  it('el MODELO rechaza datos inválidos aunque se salte el middleware (2ª capa)', async () => {
    await expect(Incidente.create({ titulo: 'Válido pero severidad mala', severidad: 'extrema' }))
      .rejects.toMatchObject({ name: 'SequelizeValidationError', errors: [expect.objectContaining({ path: 'severidad' })] });
  });

  it('el errorHandler traduce errores de validación del ORM a 400', async () => {
    const original = Incidente.create;
    Incidente.create = () => Incidente.build({ titulo: 'ok ok ok', severidad: 'mala' }).validate();
    try {
      const res = await api(app).post('/api/incidentes').send(nuevoValido).expect(400);
      expect(res.body.error.detalles[0].campo).toBe('severidad');
    } finally {
      Incidente.create = original;
    }
  });

  it('503 si la base no está disponible, SIN exponer detalles internos', async () => {
    const original = Incidente.findAndCountAll;
    Incidente.findAndCountAll = () => Promise.reject(new ConnectionError(new Error('connect ECONNREFUSED 10.0.0.5:3306 usuario=root')));
    try {
      const res = await api(app).get('/api/incidentes').expect(503);
      const texto = JSON.stringify(res.body);
      expect(!texto.includes('ECONNREFUSED') && !texto.includes('root')).toBeTruthy();
      expect(res.body.error.referencia).toBeTruthy(); // debe devolver un id de referencia
    } finally {
      Incidente.findAndCountAll = original;
    }
  });

  it('500 genérico ante una excepción no controlada, sin stack ni mensaje interno', async () => {
    const original = Incidente.findByPk;
    Incidente.findByPk = () => Promise.reject(new Error('detalle secreto del servidor'));
    try {
      const res = await api(app).get('/api/incidentes/1').expect(500);
      expect(res.body.error.mensaje).toBe('Error interno del servidor');
      expect(!JSON.stringify(res.body).includes('secreto')).toBeTruthy();
      expect(res.body.error.stack).toBe(undefined);
    } finally {
      Incidente.findByPk = original;
    }
  });

  it('envía cabeceras de seguridad y no revela la tecnología', async () => {
    const res = await api(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBe(undefined);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
