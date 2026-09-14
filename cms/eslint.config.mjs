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
    // version is "detect"; that method was removed in ESLint 10.
    settings: {
      react: {
        version: '19.2.8',
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
    ignores: ['.next/', 'src/payload-types.ts', 'src/payload-generated-schema.ts'],
  },
]

export default eslintConfig
