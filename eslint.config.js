import antfu from '@antfu/eslint-config'

export default antfu({
  ignores: [
    '**/tooling/integration-tests/src/generated/**',
    '**/tooling/seeding/src/generated/**',
  ],
  rules: {
    'no-new': 'off',
  },
}, {
  files: ['package/domain-core/src/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      paths: [
        {
          name: '@edaya/school-service',
          message: '@edaya/core must not depend on @edaya/school-service — keep entity types and ports in core; orchestration belongs in school-service.',
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
        name: '@edaya/school-service',
        message: '@edaya/authorization must not depend on @edaya/school-service — dependency direction is school-service → authorization → core.',
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
