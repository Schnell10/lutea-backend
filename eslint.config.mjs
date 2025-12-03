// @ts-check
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier'; // Je désactive les règles de style qui clash avec Prettier

export default tseslint.config(
  // J'ignore les dossiers générés, fichiers de config et scripts
  { ignores: [
    'dist/**', 
    'node_modules/**', 
    'test-env-setup.js',
    'test-all.sh',
    'eslint.config.mjs',  // Le fichier de config ESLint lui-même
    '*.md',               // Fichiers Markdown
  ] },

  // Bases JS + TS (avec type-check)
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  // Je coupe les règles qui clash avec Prettier (sans lancer Prettier via ESLint)
  eslintConfigPrettier,

  // Config générale
  {
    languageOptions: {
      sourceType: 'module', // Fichier en ESM
      parserOptions: {
        projectService: true,          // Auto-détection des tsconfig
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Assouplissements TS
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',

      // no-unused-vars : j'utilise la version TS
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],

      // Divers
      'no-console': 'off',
      'prefer-const': 'warn',
      'linebreak-style': 'off', // J'évite les soucis CRLF/LF en laissant Prettier gérer
    },
  },

  // Overrides pour les tests (Jest)
  {
    files: ['**/*.spec.ts', '**/*.test.ts'],
    languageOptions: {
      globals: { ...globals.jest },
    },
    rules: {
      // Souvent trop bruyantes en test
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
);
