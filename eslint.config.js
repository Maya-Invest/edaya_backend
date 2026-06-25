import antfu from '@antfu/eslint-config'

export default antfu({
  rules: {
    'no-new': 'off',
  },
}, {
  files: ['scripts/**'],
  rules: {
    'node/prefer-global/process': 'off',
  },
})
