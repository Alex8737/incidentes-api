/**
 * PRUEBAS UNITARIAS — clasificación de excepciones (src/middleware/errorHandler.js)
 * Regla: cada tipo de error se traduce a un código HTTP coherente y los 5xx no exponen detalles.
 */
const { ValidationError, ValidationErrorItem, UniqueConstraintError, ConnectionError } = require('sequelize');
const { clasificar } = require('../../src/middleware/errorHandler');
const AppError = require('../../src/utils/AppError');

describe('clasificar(err)', () => {
  it('respeta el código de un AppError', () => {
    expect(clasificar(new AppError('No encontrado', 404))).toMatchObject({ estado: 404, mensaje: 'No encontrado' });
  });

  it('JSON mal formado -> 400 y cuerpo demasiado grande -> 413', () => {
    expect(clasificar({ type: 'entity.parse.failed' }).estado).toBe(400);
    expect(clasificar({ type: 'entity.too.large' }).estado).toBe(413);
  });

  it('validación del ORM -> 400 con detalle por campo', () => {
    const err = new ValidationError('x', [new ValidationErrorItem('Severidad inválida', 'Validation error', 'severidad')]);
    expect(clasificar(err)).toMatchObject({ estado: 400, detalles: [{ campo: 'severidad', mensaje: 'Severidad inválida' }] });
  });

  it('valor duplicado -> 409 (se evalúa antes que ValidationError, del que hereda)', () => {
    const err = new UniqueConstraintError({ errors: [new ValidationErrorItem('dup', 'unique violation', 'usuario')] });
    expect(clasificar(err).estado).toBe(409);
  });

  it('base caída -> 503 marcado como interno', () => {
    expect(clasificar(new ConnectionError(new Error('ECONNREFUSED')))).toMatchObject({ estado: 503, interno: true });
  });

  it('error desconocido -> 500 con mensaje genérico (no filtra el mensaje original)', () => {
    const r = clasificar(new Error('contraseña de la base: 1234'));
    expect(r).toMatchObject({ estado: 500, mensaje: 'Error interno del servidor', interno: true });
  });
});
