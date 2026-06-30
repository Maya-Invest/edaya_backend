import antfu from '@antfu/eslint-config'

export default antfu({
  ignores: ['fixtures/openapi.json'],
  rules: {
    'no-new': 'off',
    'antfu/no-top-level-await': 'off',
    'node/prefer-global/process': 'off',
    'no-console': 'off',
  },
})
