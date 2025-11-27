const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const webpack = require('webpack');

module.exports = {
  // 在渲染进程禁用 nodeIntegration 的前提下，必须按 Web 目标打包，
  // 避免运行时依赖原生 require
  target: 'web',
  entry: './src/renderer/index.tsx',
  output: {
    path: path.resolve(__dirname, '../dist'),
    filename: 'renderer.js',
    publicPath: '/',
    globalObject: 'this',
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx'],
    alias: {
      '@': path.resolve(__dirname, '../src'),
      '@assets': path.resolve(__dirname, '../src/assets'),
    },
    fallback: {
      buffer: require.resolve('buffer'),
      process: require.resolve('process/browser'),
      path: require.resolve('path-browserify'),
      events: require.resolve('events'),
      util: require.resolve('util'),
      fs: false,
      module: false,
    },
  },
  node: {
    __dirname: false,
    __filename: false,
    global: true,
  },
  module: {
    rules: [
      {
        test: /\.(tsx?|jsx?)$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.module\.less$/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              modules: {
                localIdentName: '[local]__[hash:base64:6]',
              },
            },
          },
          'less-loader',
        ],
      },
      {
        test: /(?<!\.module)\.less$/,
        use: ['style-loader', 'css-loader', 'less-loader'],
      },
      {
        test: /\.(png|jpe?g|gif|svg)$/,
        type: 'asset/resource',
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      global: 'globalThis',
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      'process.env.API_ENV': JSON.stringify(process.env.API_ENV || 'dev'),
      'process.env.AIRE_API_BASE': JSON.stringify(process.env.AIRE_API_BASE || ''),
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
      global: 'globalThis',
    }),
    new HtmlWebpackPlugin({
      template: './src/renderer/index.html',
      filename: 'index.html',
    }),
    new MonacoWebpackPlugin({
      languages: ['javascript', 'typescript', 'json'],
    }),
  ],
  devServer: {
    port: 3000,
    hot: true,
    static: {
      directory: path.join(__dirname, '../dist'),
    },
    client: {
      overlay: true,
    },
  },
  mode: 'development',
  devtool: 'eval-source-map',
};
