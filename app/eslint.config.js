import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// Fronteiras entre módulos (plano de modularização): página não importa página de outra
// área, e o código compartilhado (lib, hooks, components, stores, contexts) não importa página.
// ponytail: só pega '@/pages/<área>' e '../<área>' (a partir de um arquivo direto da pasta da
// área); import relativo mais fundo ('../../admin/x') escapa. Virar 'error' quando as
// violações chegarem a zero.
const AREAS = ['admin', 'producer', 'checkout', 'auth', 'app']
const fronteira = (group, message) => ({
  rules: { 'no-restricted-imports': ['warn', { patterns: [{ group, message }] }] },
})
const deOutraArea = (prefixos, a) =>
  AREAS.filter((x) => x !== a).flatMap((x) => prefixos.flatMap((p) => [`${p}${x}`, `${p}${x}/**`]))

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  ...AREAS.map((a) => ({
    files: [`src/pages/${a}/**/*.{ts,tsx}`],
    ...fronteira(
      deOutraArea(['@/pages/', '../'], a),
      `Página de "${a}" não importa página de outra área: mova o compartilhado para components/, hooks/ ou lib/.`,
    ),
  })),
  {
    files: ['src/pages/*.{ts,tsx}'],
    ...fronteira(
      deOutraArea(['@/pages/', './'], ''),
      'Página do site não importa página de uma área: mova o compartilhado para components/, hooks/ ou lib/.',
    ),
  },
  {
    files: ['src/{lib,hooks,components,stores,contexts}/**/*.{ts,tsx}'],
    ...fronteira(['@/pages', '@/pages/**', '**/pages/**'], 'Código compartilhado não importa página.'),
  },
])
