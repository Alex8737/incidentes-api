/**
 * REGLAS DE NEGOCIO DEL ACCESO (capa Modelo)
 * Funciones puras usadas por el middleware de login. Se prueban sin servidor
 * en tests/unit/usuario.reglas.test.js.
 */
const CAMPOS_LOGIN = Object.freeze(['usuario', 'password']);
const LIMITES = Object.freeze({ usuarioMin: 3, usuarioMax: 40, passwordMin: 8, passwordMax: 100 });

const error = (campo, mensaje) => ({ campo, mensaje });

function validarUsuario(valor) {
  const largo = typeof valor === 'string' ? valor.trim().length : -1;
  return largo >= LIMITES.usuarioMin && largo <= LIMITES.usuarioMax
    ? []
    : [error('usuario', `Debe tener entre ${LIMITES.usuarioMin} y ${LIMITES.usuarioMax} caracteres`)];
}

function validarPassword(valor) {
  const largo = typeof valor === 'string' ? valor.length : -1;
  return largo >= LIMITES.passwordMin && largo <= LIMITES.passwordMax
    ? []
    : [error('password', `Debe tener entre ${LIMITES.passwordMin} y ${LIMITES.passwordMax} caracteres`)];
}

/** Valida las credenciales recibidas. Devuelve la lista de errores (vacía si son válidas). */
function validarCredenciales(datos) {
  const sobrantes = Object.keys(datos)
    .filter(c => !CAMPOS_LOGIN.includes(c))
    .map(c => error(c, 'Campo no permitido'));
  return [...sobrantes, ...validarUsuario(datos.usuario), ...validarPassword(datos.password)];
}

/**
 * Normaliza las credenciales: el nombre de usuario se recorta y pasa a minúsculas
 * (así "  Admin " y "admin" son la misma cuenta); la contraseña se usa tal cual.
 */
function normalizarCredenciales({ usuario, password }) {
  return { usuario: usuario.trim().toLowerCase(), password };
}

module.exports = { CAMPOS_LOGIN, LIMITES, validarCredenciales, normalizarCredenciales };
