module.exports = {
  rules: {
    'import/default': 'off',
    'import/order': [
      'error',
      {
        'newlines-between': 'always-and-inside-groups',
        alphabetize: {
          order: 'asc',
        },
        groups: ['builtin', 'external', 'internal', ['parent', 'index', 'sibling']],
      },
    ],
    'import/no-named-as-default': 'error',
  },
};