// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/*.tsbuildinfo'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': 'off',
      eqeqeq: ['error', 'always'],
    },
  },
  // Node: server, shared, root scripts and config files
  {
    files: ['server/**/*.ts', 'shared/**/*.ts', 'scripts/**/*.mjs', '*.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  // Browser: React + Phaser client
  {
    files: ['client/src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['client/vite.config.ts'],
    languageOptions: { globals: globals.node },
  },
  // Must be last: disables stylistic rules that conflict with Prettier
  prettier,
);
