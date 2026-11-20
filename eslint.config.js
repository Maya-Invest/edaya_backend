import { importOrder } from './tooling/repo/eslint-imports.js'
import antfu from '@antfu/eslint-config'

export default antfu({
  ignores: [
    '**/package/api-client/src/schema.d.ts',
    '**/tooling/integration-tests/src/generated/**',
    '**/tooling/seeding/src/generated/**',
  ],
  rules: {
    'perfectionist/sort-imports': importOrder,
    'no-new': 'off',
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
  files: ['package/domain-authorization/src/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      paths: [
        {
          name: '@edaya/service',
          message: '@edaya/authorization must not depend on @edaya/service — dependency direction is school-service → authorization → core.',
        },
        {
          name: '@edaya/authorization',
          message: 'Do not import @edaya/authorization from inside this package — use a relative path (circular-init risk).',
        },
      ],
    }],
  },
}, {
  files: ['package/domain-service/src/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      paths: [
        {
          name: '@edaya/service',
          message: 'Do not import @edaya/service from inside this package — use a relative path (circular-init risk).',
        },
        {
          name: '@edaya/authorization',
          importNames: ['Permission'],
          message: 'Import Permission from @edaya/core — it is defined there and only re-exported from authorization.',
        },
      ],
    }],
  },
}, {
  files: ['package/domain-service/tests/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      paths: [{
        name: '@edaya/authorization',
        importNames: ['Permission'],
        message: 'Import Permission from @edaya/core — it is defined there and only re-exported from authorization.',
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
