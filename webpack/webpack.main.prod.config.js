const merge = require('webpack-merge');
const baseConfig = require('./webpack.main.config');

module.exports = merge.merge(baseConfig, {
  mode: 'production',
  output: {
    // 生产环境输出到项目根的 dist/，与 package.json main 和 electron-builder files 对齐
    path: require('path').resolve(__dirname, '../dist'),
    filename: '[name].js',
    sourceMapFilename: 'maps/[file].map',
  },
  devtool: false,
});