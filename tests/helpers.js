/**
 * Utilidades de prueba: base SQLite EN MEMORIA, aislada de la base real.
 * Se aplican las MISMAS migraciones que en desarrollo (no se usa sync()).
 * Las contraseñas de prueba existen SOLO aquí y nunca llegan a la base real.
 */
process.env.NODE_ENV = 'test';
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';
process.env.JWT_SECRET = 'secreto-solo-para-pruebas-de-la-plataforma-0123456789';

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const request = require('supertest');
const { Sequelize } = require('sequelize');
const { sequelize, Incidente, Usuario } = require('../src/models');
const { firmar } = require('../src/middleware/auth');

const DIR_MIGRACIONES = path.join(__dirname, '..', 'src', 'database', 'migrations');
const archivos = () => fs.readdirSync(DIR_MIGRACIONES).filter(f => f.endsWith('.js')).sort();

async function migrar() {
  const qi = sequelize.getQueryInterface();
  for (const f of archivos()) await require(path.join(DIR_MIGRACIONES, f)).up(qi, Sequelize);
}

async function revertirTodo() {
  const qi = sequelize.getQueryInterface();
  for (const f of archivos().reverse()) await require(path.join(DIR_MIGRACIONES, f)).down(qi, Sequelize);
}

const FIXTURES = [
  { titulo: 'Phishing a contabilidad', descripcion: 'Correo falso del banco', categoria: 'phishing', severidad: 'alta', prioridad: 'alta', estado: 'abierto', reportadoPor: 'Mesa de ayuda' },
  { titulo: 'Ransomware en PC-VENTAS-07', descripcion: 'EDR bloqueó cifrado', categoria: 'malware', severidad: 'critica', prioridad: 'urgente', estado: 'en_progreso', reportadoPor: 'SOC' },
  { titulo: 'Fuerza bruta contra VPN', descripcion: '250 intentos fallidos', categoria: 'acceso_no_autorizado', severidad: 'media', prioridad: 'alta', estado: 'resuelto', reportadoPor: 'SIEM' },
  { titulo: 'Contraseña publicada en chat', descripcion: 'Credencial expuesta', categoria: 'fuga_de_datos', severidad: 'baja', prioridad: 'baja', estado: 'abierto', reportadoPor: 'Usuario' }
];

// Cuentas de prueba (una por rol) y sus contraseñas, solo para tests
const CUENTAS_PRUEBA = [
  { usuario: 'admin_test', nombre: 'Admin prueba', rol: 'admin', clave: 'ClaveAdmin-123' },
  { usuario: 'analista_test', nombre: 'Analista prueba', rol: 'analista', clave: 'ClaveAnalista-123' },
  { usuario: 'visor_test', nombre: 'Visor prueba', rol: 'visor', clave: 'ClaveVisor-123' }
];

/** Tokens JWT por rol, generados al reiniciar los datos. */
const tokens = {};

async function reiniciarDatos() {
  await Incidente.destroy({ where: {}, truncate: true });
  await Usuario.destroy({ where: {}, truncate: true });
  await Incidente.bulkCreate(FIXTURES);
  for (const c of CUENTAS_PRUEBA) {
    const cuenta = await Usuario.create({
      usuario: c.usuario, nombre: c.nombre, rol: c.rol,
      passwordHash: bcrypt.hashSync(c.clave, 4)
    });
    tokens[c.rol] = firmar(cuenta);
  }
}

/**
 * Cliente de pruebas que envía el token del rol indicado (por defecto, admin).
 * Las pruebas de acceso sin token usan request(app) directamente.
 */
function api(app, rol = 'admin') {
  const conToken = peticion => peticion.set('Authorization', `Bearer ${tokens[rol]}`);
  return {
    get: url => conToken(request(app).get(url)),
    post: url => conToken(request(app).post(url)),
    put: url => conToken(request(app).put(url)),
    patch: url => conToken(request(app).patch(url)),
    delete: url => conToken(request(app).delete(url))
  };
}

module.exports = {
  sequelize, Incidente, Usuario, migrar, revertirTodo, reiniciarDatos,
  FIXTURES, CUENTAS_PRUEBA, tokens, api
};
