import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginImport from 'eslint-plugin-import'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'

export default defineConfig(
  // `**/deploy` is the apps/desktop pnpm-deploy intermediate produced by
  // `pnpm run deploy` (see apps/desktop/package.json scripts and
  // electron-builder.yml `directories.output`). It copies source files
  // including the Playwright fixtures, which the originals are already
  // excused from below — without this ignore the deploy copies would
  // re-trip rules.
  { ignores: ['**/node_modules', '**/dist', '**/out', '**/deploy'] },
  tseslint.configs.recommended,
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat['jsx-runtime'],
  {
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': eslintPluginReactHooks,
      'react-refresh': eslintPluginReactRefresh
    },
    rules: {
      ...eslintPluginReactHooks.configs.recommended.rules,
      ...eslintPluginReactRefresh.configs.vite.rules
    }
  },
  {
    // Playwright fixtures call their injector `use`, which trips the
    // react-hooks/rules-of-hooks linter even though no React is in play.
    files: ['apps/desktop/tests/e2e/**/*.ts'],
    rules: {
      'react-hooks/rules-of-hooks': 'off'
    }
  },
  {
    // Block cross-app deep imports. Shared code must live in a package
    // (packages/shared or packages/cloud-scan). Prevents the phantom-dep
    // regression class that PD-2 surfaced (CLI reaching into apps/desktop/src).
    files: [
      'apps/*/src/**/*.{ts,tsx}',
      'apps/*/cli/**/*.ts',
      'apps/*/bin/**/*.ts',
      'apps/*/scripts/**/*.ts',
      'apps/*/tests/**/*.ts'
    ],
    plugins: { import: eslintPluginImport },
    settings: {
      'import/resolver': {
        typescript: { project: ['apps/*/tsconfig*.json', 'packages/*/tsconfig*.json'] },
        node: true
      }
    },
    rules: {
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './apps/cli',
              from: './apps/desktop',
              message:
                'apps/cli must not import from apps/desktop. Promote shared code to packages/shared or packages/cloud-scan.'
            },
            {
              target: './apps/desktop',
              from: './apps/cli',
              message:
                'apps/desktop must not import from apps/cli. Promote shared code to a package.'
            }
          ]
        }
      ]
    }
  },
  eslintConfigPrettier
)
