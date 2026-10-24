/**
 * CONFIGURACIÓN DE ESLINT (formato "flat config", ESLint >= 9)
 * Es autocontenida: solo necesita el paquete "eslint" (sin plugins ni paquetes extra).
 *
 * Tres entornos distintos en el mismo repositorio:
 *   - src/, scripts/, *.config.js  -> Node.js con CommonJS (require / module.exports)
 *   - tests/                        -> Node.js + globales de Jest
 *   - public/js/                    -> navegador con módulos ES (import / export)
 */

const globalesNode = {
  require: 'readonly', module: 'writable', exports: 'writable', __dirname: 'readonly', __filename: 'readonly',
  process: 'readonly', console: 'readonly', Buffer: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
  setInterval: 'readonly', clearInterval: 'readonly', setImmediate: 'readonly', URL: 'readonly',
  URLSearchParams: 'readonly', AbortController: 'readonly', AbortSignal: 'readonly', performance: 'readonly', fetch: 'readonly'
};

const globalesNavegador = {
  window: 'readonly', document: 'readonly', location: 'readonly', console: 'readonly', fetch: 'readonly',
  sessionStorage: 'readonly', localStorage: 'readonly', FormData: 'readonly', URLSearchParams: 'readonly',
  AbortController: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', confirm: 'readonly',
  performance: 'readonly', Date: 'readonly', CSS: 'readonly'
};

const globalesJest = {
  describe: 'readonly', it: 'readonly', test: 'readonly', expect: 'readonly', jest: 'readonly',
  beforeAll: 'readonly', beforeEach: 'readonly', afterAll: 'readonly', afterEach: 'readonly'
};

/** Reglas comunes: errores reales (error) y deuda de estilo/mantenibilidad (warn). */
const reglas = {
  // --- Errores probables ---
  'no-undef': 'error',
  'no-unused-vars': ['error', { args: 'after-used', argsIgnorePattern: '^_', caughtErrors: 'none' }],
  'no-unreachable': 'error',
  'no-dupe-keys': 'error',
  'no-duplicate-case': 'error',
  'no-empty': ['error', { allowEmptyCatch: false }],
  'no-fallthrough': 'error',
  'no-self-assign': 'error',
  'no-constant-condition': 'error',
  'no-prototype-builtins': 'error',
  'no-async-promise-executor': 'error',
  'require-atomic-updates': 'off',
  'use-isnan': 'error',
  'valid-typeof': 'error',

  // --- Buenas prácticas ---
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  'no-var': 'error',
  'prefer-const': 'error',
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-throw-literal': 'error',
  'no-return-await': 'error',
  'no-useless-catch': 'error',
  'no-shadow': 'warn',
  'no-param-reassign': ['warn', { props: false }],
  'no-else-return': 'warn',
  'no-lonely-if': 'warn',
  'no-useless-return': 'warn',
  'consistent-return': 'warn',
  'default-param-last': 'warn',
  'require-await': 'warn',
  curly: ['warn', 'multi-line'],

  // --- Mantenibilidad (métricas que guían la refactorización) ---
  complexity: ['warn', 10],
  'max-depth': ['warn', 3],
  'max-params': ['warn', 4],
  'max-lines-per-function': ['warn', { max: 40, skipBlankLines: true, skipComments: true }]
};

module.exports = [
  { ignores: ['node_modules/**', 'coverage/**', 'database/**', 'docs/**', 'linea-base/**', '*.zip'] },

  {
    files: ['src/**/*.js', 'scripts/**/*.js', '*.config.js', '.sequelizerc'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: globalesNode },
    rules: {
      ...reglas,
      // En el servidor la consola ES el canal de logs; se permite console.log/warn/error.
      'no-console': 'off'
    }
  },

  {
    files: ['tests/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: { ...globalesNode, ...globalesJest } },
    rules: {
      ...reglas,
      // Los bloques describe() de las pruebas son largos por naturaleza.
      'max-lines-per-function': 'off',
      'no-shadow': 'off'
    }
  },

  {
    // Las pruebas del front-end importan los módulos ES del navegador (import/export), pero se ejecutan en Node.
    files: ['tests/unit/frontend/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globalesNode, ...globalesJest } }
  },

  {
    // Scripts de demostración: son relatos lineales paso a paso; se relajan las métricas de tamaño.
    files: ['scripts/demo-api.js', 'scripts/medir-rendimiento.js', 'scripts/verificar-despliegue.js'],
    rules: { 'max-lines-per-function': 'off', 'max-params': 'off', complexity: 'off' }
  },

  {
    files: ['public/js/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: globalesNavegador },
    rules: {
      ...reglas,
      // En el navegador la consola no debe quedar con trazas de depuración.
      'no-console': ['warn', { allow: ['warn', 'error'] }]
    }
  }
];
