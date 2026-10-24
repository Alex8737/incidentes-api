/**
 * PRUEBAS UNITARIAS — autorización por rol (src/models/permisos.js)
 * Regla de negocio: visor = solo lectura; analista = lectura y escritura; admin = todo.
 */
const { puede, permisosDe, rolesPara, ACCIONES } = require('../../src/models/permisos');

describe('puede(rol, accion)', () => {
  it.each([
    ['visor', 'leer', true], ['visor', 'escribir', false], ['visor', 'eliminar', false],
    ['analista', 'leer', true], ['analista', 'escribir', true], ['analista', 'eliminar', false],
    ['admin', 'leer', true], ['admin', 'escribir', true], ['admin', 'eliminar', true], ['admin', 'verLogs', true]
  ])('%s -> %s = %s', (rol, accion, esperado) => {
    expect(puede(rol, accion)).toBe(esperado);
  });

  it('niega por defecto roles o acciones desconocidas', () => {
    expect(puede('superusuario', 'leer')).toBe(false);
    expect(puede('admin', 'formatearDisco')).toBe(false);
    expect(puede(undefined, 'leer')).toBe(false);
  });
});

describe('permisosDe(rol)', () => {
  it('lista las acciones de cada rol', () => {
    expect(permisosDe('visor')).toEqual(['leer']);
    expect(permisosDe('analista')).toEqual(['leer', 'escribir']);
    expect(permisosDe('admin')).toEqual(ACCIONES);
  });

  it('un rol inexistente no tiene permisos', () => {
    expect(permisosDe('invitado')).toEqual([]);
  });
});

describe('rolesPara(accion)', () => {
  it('devuelve los roles autorizados (usado por las rutas)', () => {
    expect(rolesPara('eliminar')).toEqual(['admin']);
    expect(rolesPara('escribir')).toEqual(['admin', 'analista']);
  });

  it('falla de inmediato si una ruta usa una acción mal escrita', () => {
    expect(() => rolesPara('elminar')).toThrow('Acción desconocida');
  });

  it('devuelve una copia: modificarla no altera las reglas', () => {
    rolesPara('eliminar').push('visor');
    expect(puede('visor', 'eliminar')).toBe(false);
  });
});
