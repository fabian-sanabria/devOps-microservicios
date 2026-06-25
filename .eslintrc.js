/**
 * ESLint — Configuración compartida para todos los microservicios
 *
 * Un solo archivo en la raíz aplica las mismas reglas a:
 *   auth-service, catalog-service, orders-service, payments-service
 *
 * Cómo correr:
 *   npm run lint              → revisa todos los servicios
 *   npm run lint:auth         → solo auth-service
 *   npm run lint:fix          → corrige automáticamente lo que puede
 */

module.exports = {
  // root: true → ESLint deja de buscar configs en carpetas superiores.
  // Sin esto, si tienes otra config en /home o en /, la mezclaría.
  root: true,

  // parser → indica a ESLint que el código es TypeScript, no JavaScript puro.
  // Sin esto, ESLint no entiende los tipos, decoradores (@Injectable, etc.).
  parser: '@typescript-eslint/parser',

  parserOptions: {
    // Versión de ECMAScript a parsear (ES2021 = await/async, optional chaining, etc.)
    ecmaVersion: 2021,
    // "module" → el código usa import/export en vez de require()
    sourceType: 'module',
  },

  // plugins → carga el conjunto de reglas de TypeScript para ESLint
  plugins: ['@typescript-eslint'],

  // extends → activa conjuntos de reglas predefinidas
  extends: [
    // Reglas recomendadas de @typescript-eslint:
    // detecta tipos incorrectos, variables sin usar, any implícito, etc.
    'plugin:@typescript-eslint/recommended',
  ],

  // env → indica en qué entorno corre el código.
  // Evita falsos positivos como "process is not defined" o "describe is not defined".
  env: {
    node: true,  // process, __dirname, require, etc.
    jest: true,  // describe, it, expect, beforeEach, etc. (para los .spec.ts)
  },

  // ignorePatterns → archivos y carpetas que ESLint NO analiza
  ignorePatterns: [
    'dist/',          // código compilado (generado automáticamente)
    'node_modules/',  // dependencias externas
    'coverage/',      // reportes de cobertura
    '*.js',           // este mismo archivo y otros .js en la raíz
    '*.json',         // archivos de configuración
  ],

  // rules → reglas individuales con su nivel: 'off', 'warn', 'error'
  // 'error' → el lint FALLA y bloquea el PR
  // 'warn'  → aparece en el reporte pero NO bloquea (por el --max-warnings=0 sí)
  // 'off'   → desactivada
  rules: {
    // NestJS usa "any" en guards, interceptors y pipes → solo advertir
    '@typescript-eslint/no-explicit-any': 'warn',

    // Variables sin usar → advertir, pero ignorar las que empiezan con _
    // Ejemplo: const { passwordHash, ...profile } = user;
    //          passwordHash se "usa" para excluirla del objeto, es intencional
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        // ignoreRestSiblings: true → ignora vars extraídas por destructuring (como passwordHash)
        ignoreRestSiblings: true,
      },
    ],

    // NestJS usa decoradores que a veces requieren métodos vacíos
    '@typescript-eslint/no-empty-function': 'warn',

    // TypeScript infiere los return types en controllers/services de NestJS
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',

    // console.log en producción → usar Logger de NestJS en su lugar
    'no-console': 'warn',

    // Estas dos sí son ERRORES: bloquean el PR si alguien las viola
    'no-var': 'error',       // siempre usa const o let, nunca var
    'prefer-const': 'error', // si no reasignas, usa const
  },

  // overrides → reglas distintas para archivos específicos
  overrides: [
    {
      // En archivos de test (.spec.ts) relajamos las reglas:
      // los mocks y stubs legítimamente usan "any" y variables auxiliares
      files: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        'no-console': 'off',
      },
    },
  ],
};
