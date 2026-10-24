/**
 * PRUEBAS DE SEGURIDAD (Reto 3): autenticación JWT, roles, CORS, hash de contraseñas
 * y validación de entradas. Se ejecutan contra una base SQLite en memoria.
 */
const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { sequelize, Incidente, Usuario, migrar, reiniciarDatos, api, tokens, CUENTAS_PRUEBA } = require('../helpers');
const app = require('../../src/app');
const env = require('../../src/config/env');

const nuevo = {
  titulo: 'Escaneo de puertos desde IP externa',
  descripcion: 'El IDS detectó un escaneo sobre la DMZ.',
  categoria: 'acceso_no_autorizado',
  severidad: 'media',
  prioridad: 'alta'
};

const credenciales = rol => {
  const c = CUENTAS_PRUEBA.find(x => x.rol === rol);
  return { usuario: c.usuario, password: c.clave };
};

beforeAll(migrar);
beforeEach(reiniciarDatos);
afterAll(() => sequelize.close());

describe('Autenticación (JWT)', () => {
  it('1. Login correcto devuelve un token JWT y no expone el hash de la contraseña', async () => {
    const res = await request(app).post('/api/auth/login').send(credenciales('admin')).expect(200);
    expect(res.body.token).toBeTruthy(); // debe devolver un token
    expect(res.body.datos.rol).toBe('admin');
    expect(res.body.datos.passwordHash).toBe(undefined);
    expect(!JSON.stringify(res.body).includes('$2')).toBeTruthy(); // no debe aparecer ningún hash bcrypt
  });

  it('2. Login con contraseña incorrecta responde 401 con mensaje genérico', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ usuario: 'admin_test', password: 'ClaveMala-999' }).expect(401);
    expect(res.body.error.mensaje).toBe('Usuario o contraseña incorrectos');
  });

  it('3. Login con usuario inexistente responde igual que una clave incorrecta (no revela cuentas)', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ usuario: 'no_existe_99', password: 'ClaveMala-999' }).expect(401);
    expect(res.body.error.mensaje).toBe('Usuario o contraseña incorrectos');
  });

  it('4. La contraseña se guarda como hash bcrypt, nunca en texto plano', async () => {
    const cuenta = await Usuario.scope('conPassword').findOne({ where: { usuario: 'admin_test' } });
    expect(cuenta.passwordHash).not.toBe('ClaveAdmin-123');
    expect(bcrypt.compareSync('ClaveAdmin-123', cuenta.passwordHash)).toBeTruthy();
  });

  it('5. Sin token se bloquea el acceso a incidentes (401)', async () => {
    await request(app).get('/api/incidentes').expect(401);
    await request(app).post('/api/incidentes').send(nuevo).expect(401);
  });

  it('6. Un token alterado o firmado con otra clave es rechazado (401)', async () => {
    const falso = jwt.sign({ sub: 1, rol: 'admin' }, 'otra-clave-que-no-es-la-buena-0123456789abcdef');
    await request(app).get('/api/incidentes').set('Authorization', `Bearer ${falso}`).expect(401);
    const alterado = tokens.visor.slice(0, -2) + 'xx';
    await request(app).get('/api/incidentes').set('Authorization', `Bearer ${alterado}`).expect(401);
  });

  it('7. Un token expirado es rechazado (401)', async () => {
    const vencido = jwt.sign({ sub: 1, rol: 'admin' }, env.JWT_SECRET,
      { issuer: 'incidentes-api', expiresIn: -10 });
    await request(app).get('/api/incidentes').set('Authorization', `Bearer ${vencido}`).expect(401);
  });

  it('8. Una cuenta desactivada pierde el acceso aunque su token siga vigente (401)', async () => {
    await Usuario.update({ activo: false }, { where: { usuario: 'visor_test' } });
    await api(app, 'visor').get('/api/incidentes').expect(401);
  });
});

describe('Autorización por roles', () => {
  it('9. El visor puede consultar pero NO crear incidentes (403)', async () => {
    await api(app, 'visor').get('/api/incidentes').expect(200);
    await api(app, 'visor').post('/api/incidentes').send(nuevo).expect(403);
    const enBase = await Incidente.count();
    expect(enBase).toBe(4); // no debe insertarse nada
  });

  it('10. El analista puede crear y modificar, pero NO eliminar (403)', async () => {
    const crea = await api(app, 'analista').post('/api/incidentes').send(nuevo).expect(201);
    await api(app, 'analista').patch(`/api/incidentes/${crea.body.datos.id}`).send({ estado: 'cerrado' }).expect(200);
    await api(app, 'analista').delete(`/api/incidentes/${crea.body.datos.id}`).expect(403);
    expect(await Incidente.findByPk(crea.body.datos.id)).toBeTruthy(); // el registro debe seguir existiendo
  });

  it('11. Solo el administrador puede eliminar y ver los logs del servidor', async () => {
    const id = (await Incidente.findOne()).id;
    await api(app, 'admin').delete(`/api/incidentes/${id}`).expect(204);
    await api(app, 'analista').get('/api/logs').expect(403);
    await api(app, 'visor').get('/api/logs').expect(403);
    await api(app, 'admin').get('/api/logs').expect(200);
  });

  it('12. Un visor no puede modificar un incidente existente (PUT/PATCH = 403) y no cambia nada', async () => {
    const id = (await Incidente.findOne()).id;
    const antes = (await Incidente.findByPk(id)).estado;
    await api(app, 'visor').patch(`/api/incidentes/${id}`).send({ estado: 'cerrado' }).expect(403);
    await api(app, 'visor').put(`/api/incidentes/${id}`).send(nuevo).expect(403);
    expect((await Incidente.findByPk(id)).estado).toBe(antes);
  });
});

describe('Validación y limpieza de entradas', () => {
  it('13. El login rechaza campos extra (asignación masiva, p. ej. rol: admin)', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ usuario: 'visor_test', password: 'ClaveVisor-123', rol: 'admin' }).expect(400);
    expect(res.body.error.detalles[0].campo).toBe('rol');
  });

  it('14. Las credenciales se validan antes de consultar la base (400)', async () => {
    await request(app).post('/api/auth/login').send({ usuario: 'ab', password: '123' }).expect(400);
    await request(app).post('/api/auth/login').send({ usuario: 'visor_test' }).expect(400);
  });

  it('15. Una inyección SQL en el usuario no provoca acceso', async () => {
    await request(app).post('/api/auth/login')
      .send({ usuario: "admin_test' OR '1'='1", password: 'cualquiera-123' }).expect(401);
  });

  it('16. Las cabeceras CORS solo se permiten para los orígenes configurados', async () => {
    const ok = await request(app).get('/api/health').set('Origin', 'http://localhost:3000');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(ok.headers['access-control-allow-headers']).toMatch(/Authorization/);
    const extraño = await request(app).get('/api/health').set('Origin', 'https://sitio-malicioso.example');
    expect(extraño.headers['access-control-allow-origin']).toBe(undefined);
  });

  it('17. Un usuario sin sesión no puede ver el perfil; con sesión sí ve sus propios datos', async () => {
    await request(app).get('/api/auth/me').expect(401);
    const res = await api(app, 'analista').get('/api/auth/me').expect(200);
    expect(res.body.datos.rol).toBe('analista');
    expect(res.body.datos.passwordHash).toBe(undefined);
  });
});
