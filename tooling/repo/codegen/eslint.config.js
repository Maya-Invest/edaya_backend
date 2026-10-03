import antfu from '@antfu/eslint-config'

export default antfu({
  type: 'lib',
  typescript: true,
  formatters: false,
  stylistic: {
    indent: 'tab',
    quotes: 'single',
    semi: false,
  },
  ignores: ['**/node_modules/*', 'tests/fixtures/**'],
  rules: {
    'perfectionist/sort-imports': 'off',
    'perfectionist/sort-exports': 'off',
    'perfectionist/sort-named-imports': 'off',
    'perfectionist/sort-named-exports': 'off',
    'import/consistent-type-specifier-style': 'off',
    'node/prefer-global/process': 'off',
    'no-console': 'off',
    'unicorn/prefer-type-error': 'off',
  },
})
