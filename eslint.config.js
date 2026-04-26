export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      '*.config.js',
      '*.config.ts',
      'tests/**/*',
      'src/**/__tests__/**/*',
    ],
  },
  {
    files: ['**/*.js'],
    rules: {
      'no-console': 'off',
      'no-undef': 'off',
    },
  },
];
