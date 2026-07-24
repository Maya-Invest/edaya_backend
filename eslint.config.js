import antfu from '@antfu/eslint-config'

export default antfu({
  ignores: [
    '**/tooling/integration-tests/src/generated/**',
    '**/tooling/seeding/src/generated/**',
    '**/package/document-rendering/src/**/*.precompiled.js',
    '**/package/document-rendering/src/**/*.hbs',
    '**/package/docs-client/src/openapi.json',
    '**/package/docs-client/src/schema.d.ts',
    '**/tooling/docs/openapi/fixtures/**',
  ],
  rules: {
    'no-new': 'off',
  },
}, {
  files: ['apps/docs/**/*.ts', 'package/document-*/**/*.ts', 'package/docs-client/**/*.ts', 'tooling/docs/**/*.ts', 'scripts/docs/**/*.ts', 'tests/docs/**/*.ts'],
  rules: {
    'no-console': 'off',
    'antfu/no-top-level-await': 'off',
    'node/prefer-global/process': 'off',
  },
}, {
  files: ['package/domain-core/src/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      paths: [
        {
          name: '@edaya/service',
          message: '@edaya/core must not depend on @edaya/service — keep entity types and ports in core; orchestration belongs in school-service.',
        },
        {
          name: '@edaya/authorization',
          message: '@edaya/core must not depend on @edaya/authorization — dependency direction is school-service → authorization → core.',
        },
      ],
    }],
  },
}, {
  files: ['package/authorization/src/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      paths: [{
        name: '@edaya/service',
        message: '@edaya/authorization must not depend on @edaya/service — dependency direction is school-service → authorization → core.',
      }],
    }],
  },
}, {
  files: ['tooling/repo/**', 'tooling/integration-tests/smoke/**'],
  rules: {
    'antfu/no-top-level-await': 'off',
    'node/prefer-global/process': 'off',
    'no-console': 'off',
  },
})
