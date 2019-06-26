module.exports = api => {
  const env = api.env();
  const esm = env === 'esm';
  const test = env === 'test';
  const development = env === 'development';
  const plugins = [];
  if (test) {
    plugins.push('babel-plugin-istanbul');
  }
  return {
    presets: [
      [
        '@babel/preset-env',
        {
          modules: esm ? false : undefined,
          targets: {
            node: development || test ? 'current' : '6',
            esmodules: esm,
          },
        },
      ],
      '@babel/preset-typescript',
    ],
    plugins,
    overrides: [
      {
        test: ['./packages/my-resume', './packages/resume-template'],
        plugins,
        presets: [
          '@babel/preset-react',
          [
            '@babel/preset-env',
            {
              modules: esm ? false : undefined,
              targets: { esmodules: esm },
            },
          ],
        ],
      },
    ],
  };
};
