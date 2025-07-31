const { defineConfig } = require('@vue/cli-service')

module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    port: 8080, // 确保端口为8080
    // 移除代理配置，因为前端和Electron通过IPC通信
    // 不需要HTTP代理
  },
  // 生产环境配置
  publicPath: process.env.NODE_ENV === 'production' ? './' : '/',
  outputDir: 'dist',
  assetsDir: 'static'
})
