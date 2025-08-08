const path = require('path');

module.exports = {
  target: 'electron-main',
  entry: {
    main: './src/main/index.ts',
    preload: './src/main/preload.ts',
  },
  output: {
    path: path.resolve(__dirname, '../app'),
    filename: '[name].js',
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, '../src'),
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  node: {
    __dirname: false,
    __filename: false,
  },
  externals: {
    whistle: 'commonjs whistle',
    'fs-extra': 'commonjs fs-extra',
    'electron-log': 'commonjs electron-log',
    'electron-is-dev': 'commonjs electron-is-dev',
    'electron-window-state': 'commonjs electron-window-state',
  },
  mode: 'development',
};