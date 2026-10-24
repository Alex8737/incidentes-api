/**
 * PRUEBAS DEL LÍMITE DE INTENTOS DE LOGIN (Reto 4): defensa básica contra fuerza bruta.
 * Se usa una app mínima y un reloj controlado: no hace falta esperar minutos reales.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'secreto-solo-para-pruebas-de-la-plataforma-0123456789';

const express = require('express');
const request = require('supertest');
const crearLimiteLogin = require('../../src/middleware/limiteLogin');
const errorHandler = require('../../src/middleware/errorHandler');

function appConLimite(opciones) {
  const limite = crearLimiteLogin(opciones);
  const app = express();
  app.use(express.json());
  app.post('/login', limite, (req, res) => (req.body.clave === 'correcta' ? res.json({ ok: true }) : res.status(401).json({ ok: false })));
  app.use(errorHandler);
  return app;
}

const fallar = app => request(app).post('/login').send({ clave: 'mala' });
const acertar = app => request(app).post('/login').send({ clave: 'correcta' });

describe('Límite de intentos fallidos de inicio de sesión', () => {
  it('tras superar el máximo responde 429 con Retry-After', async () => {
    const app = appConLimite({ max: 3, ventanaMs: 60000 });
    for (let i = 0; i < 3; i++) await fallar(app).expect(401);
    const bloqueado = await fallar(app).expect(429);
    expect(Number(bloqueado.headers['retry-after'])).toBeGreaterThan(0);
    expect(bloqueado.body.error.mensaje).toMatch(/Demasiados intentos/);
  });

  it('incluso la clave correcta se rechaza mientras dure el bloqueo', async () => {
    const app = appConLimite({ max: 2, ventanaMs: 60000 });
    await fallar(app); await fallar(app);
    await acertar(app).expect(429);
  });

  it('un inicio de sesión correcto reinicia el contador', async () => {
    const app = appConLimite({ max: 3, ventanaMs: 60000 });
    await fallar(app); await fallar(app);
    await acertar(app).expect(200);
    await fallar(app).expect(401);
    await fallar(app).expect(401);
    await fallar(app).expect(401); // 3 fallos nuevos: recién ahora se llega al máximo
    await fallar(app).expect(429);
  });

  it('pasada la ventana de tiempo se vuelve a permitir', async () => {
    let ahora = 1000000;
    const app = appConLimite({ max: 2, ventanaMs: 1000, ahora: () => ahora });
    await fallar(app); await fallar(app);
    await fallar(app).expect(429);
    ahora += 1500;
    await acertar(app).expect(200);
  });
});
