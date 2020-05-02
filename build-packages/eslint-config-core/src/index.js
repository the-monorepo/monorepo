module.exports = {
  rules: {
    quotes: ['error', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-empty': 'error',
    'no-unused-vars': 'error',
    'object-literal-sort-keys': 'off',
    'prefer-template': 'error',
  },
};
