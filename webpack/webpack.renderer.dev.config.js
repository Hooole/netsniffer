const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const webpack = require('webpack');

module.exports = {
  target: 'web', // 改为web而不是electron-renderer
  entry: './src/renderer/index.tsx',
  output: {
    path: path.resolve(__dirname, '../app/dist'),
    filename: 'renderer.js',
    publicPath: '/',
    globalObject: 'this',
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx'],
    alias: {
      '@': path.resolve(__dirname, '../src'),
    },
    fallback: {
      "buffer": require.resolve("buffer"),
      "process": require.resolve("process/browser"),
      "path": require.resolve("path-browserify"),
      "fs": false,
      "module": false,
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
        test: /\.less$/,
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
      directory: path.join(__dirname, '../app/dist'),
    },
  },
  mode: 'development',
  devtool: 'eval-source-map',
};