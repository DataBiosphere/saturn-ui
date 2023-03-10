module.exports = {
  plugins: ['lodash-fp', 'simple-import-sort', 'import', 'prettier'],
  extends: ['prettier', 'airbnb', 'airbnb-typescript'],
  parserOptions: {
    project: './tsconfig.json',
  },
  settings: {
    'import/resolver': {
      'eslint-import-resolver-custom-alias': {
        alias: {
          src: './src',
          types: './types',
        },
        extensions: ['.js', '.ts'],
      },
    },
  },
  rules: {
    'max-len': ['error', { code: 120 }],
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        vars: 'all',
        args: 'all',
        argsIgnorePattern: '^_|^props',
        ignoreRestSiblings: true,
      },
    ],
  },
};
