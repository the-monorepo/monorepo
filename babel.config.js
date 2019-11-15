module.exports = api => {
  const env = api.env();
  const esm = env === 'esm';
  const test = env === 'test';
  const development = env === 'development';
  const plugins = [];
  if (test) {
    plugins.push(
      [
        'babel-plugin-istanbul',
        {
          exclude: [
            '**/*.test.{js,jsx,ts,tsx}',
            './{faultjs,misc}/*/test/**',
            './test/**',
          ],
        },
      ],
      'rewiremock/babel',
    );
  }
  const classPropertyPlugin = [
    '@babel/plugin-proposal-class-properties',
    { loose: true },
  ];
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
      [
        '@babel/preset-typescript',
        {
          jsxPragma: 'mbx',
        },
      ],
    ],
    plugins: plugins.concat([classPropertyPlugin]),
    overrides: [
      {
        test: [
          './misc/my-resume',
          './misc/resume-template',
          './misc/mobx-dom',
          './faultjs/fault-benchmarker/src/frontend',
        ],
        plugins: plugins.concat([
          '@babel/plugin-syntax-jsx',
          'babel-plugin-transform-mobx-jsx',
          ['@babel/plugin-proposal-decorators', { legacy: true }],
          classPropertyPlugin,
          '@babel/plugin-transform-strict-mode',
        ]),
        presets: [
          [
            '@babel/preset-env',
            {
              modules: esm ? false : undefined,
              targets: {
                esmodules: esm,
                browsers: ['last 1 Chrome versions'],
              },
            },
          ],
        ],
      },
    ],
  };
};
