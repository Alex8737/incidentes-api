/**
 * REGLAS DE AUTORIZACIÓN POR ROL (capa Modelo)
 * Única fuente de verdad: las usan las rutas del servidor y, a través de la respuesta
 * de /api/auth/login y /api/auth/me, también el front-end para mostrar u ocultar acciones.
 */
const PERMISOS_POR_ACCION = Object.freeze({
  leer: Object.freeze(['admin', 'analista', 'visor']),
  escribir: Object.freeze(['admin', 'analista']),
  eliminar: Object.freeze(['admin']),
  verLogs: Object.freeze(['admin'])
});

const ACCIONES = Object.freeze(Object.keys(PERMISOS_POR_ACCION));

/** ¿El rol puede realizar la acción? Acciones o roles desconocidos -> false (denegar por defecto). */
function puede(rol, accion) {
  const roles = PERMISOS_POR_ACCION[accion];
  return Boolean(roles && roles.includes(rol));
}

/** Lista de acciones permitidas para un rol, p. ej. ['leer', 'escribir']. */
function permisosDe(rol) {
  return ACCIONES.filter(accion => puede(rol, accion));
}

/** Roles que pueden realizar una acción (para el middleware autorizar). */
function rolesPara(accion) {
  const roles = PERMISOS_POR_ACCION[accion];
  if (!roles) throw new Error(`Acción desconocida: ${accion}`);
  return [...roles];
}

module.exports = { PERMISOS_POR_ACCION, ACCIONES, puede, permisosDe, rolesPara };
