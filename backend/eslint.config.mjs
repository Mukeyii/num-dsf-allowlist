// eslint.config.mjs — backend (Node/Express, CommonJS source, TS)
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      // Curated to stay green on existing code; ratchet to 'error' later.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-require-imports': 'off',
      // Express Request augmentation requires `declare global { namespace Express }`.
      '@typescript-eslint/no-namespace': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-useless-escape': 'warn',
      'no-case-declarations': 'warn',
      'prefer-const': 'warn',
      'no-console': 'off',
    },
  },
  {
    files: ['**/__tests__/**/*.ts'],
    languageOptions: { globals: { ...globals.jest } },
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
);
