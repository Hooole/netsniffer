const merge = require('webpack-merge');
const baseConfig = require('./webpack.main.config');

module.exports = merge.merge(baseConfig, {
  mode: 'production',
  output: {
    path: require('path').resolve(__dirname, '../app/dist'),
    filename: '[name].js',
  },
  devtool: 'source-map',
});