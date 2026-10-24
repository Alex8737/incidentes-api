/**
 * CONFIGURACIÓN DE JEST (Reto 3 - Unidad 7)
 *
 *   npm test                -> todas las pruebas
 *   npm run test:unit       -> solo unitarias (rápidas, sin base de datos)
 *   npm run test:cobertura  -> informe de cobertura en coverage/
 *
 * Dos proyectos porque el código corre en entornos distintos:
 *   - "unitarias front": módulos ES del navegador (import/export), transformados con babel-jest.
 *   - "servidor": CommonJS de Node (unitarias del back-end + integración con supertest).
 */
module.exports = {
  projects: [
    {
      displayName: 'front',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/unit/frontend/**/*.test.js'],
      transform: { '^.+\\.js$': ['babel-jest', { presets: [['@babel/preset-env', { targets: { node: 'current' } }]] }] }
    },
    {
      displayName: 'servidor',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/unit/*.test.js', '<rootDir>/tests/integracion/**/*.test.js'],
      transform: {}
    }
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    'public/js/**/*.js',
    '!src/database/**',
    '!src/server.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov'],
  // Las reglas de negocio son el núcleo del sistema: deben estar cubiertas casi por completo.
  coverageThreshold: {
    'src/models/incidente.reglas.js': { statements: 95, branches: 90, functions: 95, lines: 95 },
    'src/models/permisos.js': { statements: 100, branches: 100, functions: 100, lines: 100 }
  },
  testTimeout: 15000,
  verbose: true
};
