const merge = require('webpack-merge');
const devConfig = require('./webpack.renderer.dev.config');

module.exports = merge.merge(devConfig, {
  mode: 'production',
  devtool: 'source-map',
  optimization: {
    minimize: true,
  },
  devServer: undefined, // 移除开发服务器配置
});