// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['.expo/*', 'dist/*', 'ios/*', 'android/*', 'design/*', 'website/*', 'supabase/functions/*', 'hairday.html'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // CLAUDE.md: no `any` without a comment saying why.
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
]);
