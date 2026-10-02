import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';
import prettier from 'eslint-config-prettier';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'Prohibido: los tokens viven en cookies httpOnly.' },
        { name: 'sessionStorage', message: 'Prohibido: los tokens viven en cookies httpOnly.' },
      ],
    },
  },
  {
    // La app nunca debe importar los mocks directamente: solo el BFF en modo mock.
    files: ['src/app/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}', 'src/lib/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['@/mocks/*', '@/server/*'] }],
    },
  },
  {
    files: ['src/app/api/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: ['@/mocks/*'] }] },
  },
  prettier,
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      '.next-e2e/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      'playwright-report/**',
      'test-results/**',
    ],
  },
];

export default eslintConfig;
