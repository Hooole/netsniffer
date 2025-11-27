const merge = require('webpack-merge');
const path = require('path');
const devConfig = require('./webpack.renderer.dev.config');
const webpack = require('webpack');

module.exports = merge.merge(devConfig, {
  mode: 'production',
  devtool: false,
  // 生产环境输出到项目根 dist/，与主进程一致，便于打包
  output: {
    path: path.resolve(__dirname, '../dist'),
    filename: 'renderer.js',
    sourceMapFilename: 'maps/[file].map',
    // 在 Electron 中，使用 ./ 让资源相对于 HTML 文件加载
    publicPath: './',
    globalObject: 'this',
  },
  // 生产环境也按 web 目标构建，配合 preload + contextIsolation 的安全模型
  target: 'web',
  optimization: {
    minimize: true,
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.API_ENV': JSON.stringify(process.env.API_ENV || 'prod'),
      'process.env.AIRE_API_BASE': JSON.stringify(process.env.AIRE_API_BASE || ''),
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
      global: 'globalThis',
    }),
  ],
  devServer: undefined, // 移除开发服务器配置
});
