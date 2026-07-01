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
  files: ['tooling/repo/**', 'tooling/integration-tests/smoke/**'],
  rules: {
    'antfu/no-top-level-await': 'off',
    'node/prefer-global/process': 'off',
    'no-console': 'off',
  },
})
