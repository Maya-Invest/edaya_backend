import antfu from '@antfu/eslint-config'

export default antfu({
  ignores: ['fixtures/openapi.json', 'codegen/**'],
  rules: {
    'no-new': 'off',
    'antfu/no-top-level-await': 'off',
    'node/prefer-global/process': 'off',
    'no-console': 'off',
  },
}, {
  files: ['db/**/*.ts'],
  rules: {
    'dot-notation': 'off',
  },
})
