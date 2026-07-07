// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*'],
  },
  {
    rules: {
      // Constitution ("Languages: no `any` type escapes"): make violations
      // build-breaking rather than advisory.
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
]);
