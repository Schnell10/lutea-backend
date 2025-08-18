// @ts-check
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier'; // désactive les règles de style

export default tseslint.config(
  // Ignorer les dossiers générés
  { ignores: ['dist/**', 'node_modules/**'] },

  // Bases JS + TS (avec type-check)
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  // Couper les règles qui clashent avec Prettier (sans lancer Prettier via ESLint)
  eslintConfigPrettier,

  // Config générale
  {
    languageOptions: {
      sourceType: 'module', // ton fichier est en ESM
      parserOptions: {
        projectService: true,          // auto-détection des tsconfig
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // assouplissements TS
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',

      // no-unused-vars: utiliser la version TS
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],

      // divers
      'no-console': 'off',
      'prefer-const': 'warn',
      'linebreak-style': 'off', // évite les soucis CRLF/LF si tu laisses Prettier gérer
    },
  },

  // Overrides tests (Jest)
  {
    files: ['**/*.spec.ts', '**/*.test.ts'],
    languageOptions: {
      globals: { ...globals.jest },
    },
    rules: {
      // souvent trop bruyantes en test
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
);
