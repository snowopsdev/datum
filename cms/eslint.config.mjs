import nextPlugin from 'eslint-config-next'
import tseslint from 'typescript-eslint'

const eslintConfig = [
  ...nextPlugin,
  // eslint-config-next still parses JS with a Babel parser that lacks
  // ESLint 10's ScopeManager#addGlobals. Use typescript-eslint for all
  // linted files until Next vendors a compatible parser.
  {
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
  },
  {
    // eslint-plugin-react 7.37 still calls context.getFilename() when
    // version is "detect"; that method was removed in ESLint 10. Keep this in
    // step with the `react` version in package.json.
    settings: {
      react: {
        version: '19.3.0',
      },
    },
  },
  {
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: false,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|ignore)',
        },
      ],
    },
  },
  {
    // Payload generates every migration with `({ db, payload, req })`, used or
    // not. Those 46 warnings buried anything real in the lint output. Only the
    // arguments are exempt: an unused import or local in a migration still warns.
    files: ['src/migrations/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'none',
          ignoreRestSiblings: false,
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|ignore)',
        },
      ],
    },
  },
  {
    ignores: ['.next/', 'src/payload-types.ts'],
  },
]

export default eslintConfig
