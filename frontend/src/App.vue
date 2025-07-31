<template>
  <div id="app">
    <el-container>
      <el-header>
        <div class="header-content">
          <h1>🔍 RPA-AI 抓包工具</h1>
          <div class="header-actions">
            <el-button type="primary" @click="showCertificateStatus" :loading="certLoading">
              📜 证书状态
            </el-button>
            <el-button type="success" @click="startCapture" :loading="captureLoading" :disabled="isCapturing">
              ▶️ 开始抓包
            </el-button>
            <el-button type="danger" @click="stopCapture" :disabled="!isCapturing">
              ⏹️ 停止抓包
            </el-button>
            <el-button type="warning" @click="showExportDialog" :disabled="!capturedData.length">
              📤 导出数据
            </el-button>
            <el-button @click="showClearDataConfirm" :disabled="!capturedData.length">
              🗑️ 清空数据
            </el-button>
          </div>
        </div>
      </el-header>

      <el-main>
        <el-row :gutter="20">
          <el-col :span="8">
            <el-card class="status-card">
              <template #header>
                <div class="card-header">
                  <span>📊 状态信息</span>
                </div>
              </template>
              <div class="status-info">
                <p><strong>代理状态:</strong> 
                  <el-tag :type="isCapturing ? 'success' : 'info'">
                    {{ isCapturing ? '运行中' : '已停止' }}
                  </el-tag>
                </p>
                <p><strong>代理端口:</strong> {{ proxyPort }}</p>
                <p><strong>抓包数量:</strong> {{ capturedData.length }}</p>
                <p><strong>运行时间:</strong> {{ runningTime }}</p>
                <p><strong>证书状态:</strong> 
                  <el-tag :type="certStatus.installed ? 'success' : 'warning'">
                    {{ certStatus.installed ? '已安装' : '未安装' }}
                  </el-tag>
                </p>
                <p><strong>系统代理:</strong> 
                  <el-tag :type="proxyStatus.enabled ? 'success' : 'warning'">
                    {{ proxyStatus.enabled ? '已设置' : '未设置' }}
                  </el-tag>
                  <el-button 
                    v-if="!proxyStatus.enabled && isCapturing" 
                    type="primary" 
                    size="small" 
                    @click="setProxyManually"
                    style="margin-left: 10px;">
                    手动设置
                  </el-button>
                </p>
              </div>
            </el-card>

            <el-card class="config-card">
              <template #header>
                <div class="card-header">
                  <span>⚙️ 配置设置</span>
                </div>
              </template>
              <el-form :model="config" label-width="80px">
                <el-form-item label="代理端口">
                  <el-input-number 
                    v-model="config.port" 
                    :min="1024" 
                    :max="65535"
                    :disabled="isCapturing">
                  </el-input-number>
                </el-form-item>
                <el-form-item label="过滤域名">
                  <el-input 
                    v-model="config.filter" 
                    placeholder="例如: example.com"
                    :disabled="isCapturing">
                  </el-input>
                </el-form-item>
              </el-form>
            </el-card>
          </el-col>

          <el-col :span="16">
            <el-card class="data-card">
              <template #header>
                <div class="card-header">
                  <span>📋 抓包数据</span>
                  <div class="header-actions">
                    <el-input 
                      v-model="searchQuery" 
                      placeholder="搜索请求..."
                      style="width: 200px; margin-right: 10px;">
                      <template #prefix>
                        <el-icon><Search /></el-icon>
                      </template>
                    </el-input>
                    <el-select v-model="filterProtocol" placeholder="协议过滤" style="width: 120px;">
                      <el-option label="全部" value=""></el-option>
                      <el-option label="HTTP" value="http"></el-option>
                      <el-option label="HTTPS" value="https"></el-option>
                    </el-select>
                  </div>
                </div>
              </template>
              
              <el-table 
                :data="filteredData" 
                style="width: 100%"
                max-height="500"
                @row-click="showDetail">
                <el-table-column prop="timestamp" label="时间" width="180">
                  <template #default="scope">
                    {{ formatTime(scope.row.timestamp) }}
                  </template>
                </el-table-column>
                <el-table-column prop="method" label="方法" width="80">
                  <template #default="scope">
                    <el-tag :type="getMethodColor(scope.row.method)">
                      {{ scope.row.method }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="url" label="URL" min-width="200">
                  <template #default="scope">
                    <div class="url-cell">
                      <span class="url-text">{{ scope.row.url }}</span>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column prop="host" label="主机" width="150"></el-table-column>
                <el-table-column prop="protocol" label="协议" width="80">
                  <template #default="scope">
                    <el-tag :type="scope.row.protocol === 'https' ? 'success' : 'info'">
                      {{ scope.row.protocol.toUpperCase() }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="statusCode" label="状态" width="80">
                  <template #default="scope">
                    <el-tag v-if="scope.row.statusCode" :type="getStatusColor(scope.row.statusCode)">
                      {{ scope.row.statusCode }}
                    </el-tag>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
              </el-table>
            </el-card>
          </el-col>
        </el-row>
      </el-main>
    </el-container>

    <!-- 组件化弹框 -->
    <CertificateStatusDialog 
      v-model:visible="certStatusVisible"
      :cert-status-data="certStatusData"
      :loading="certLoading"
      @refresh="refreshCertStatus"
      @install="installCertificate"
      @open-file="openCertificateFile" />

    <RequestDetailDialog 
      v-model:visible="detailVisible"
      :request="selectedRequest" />

    <ExportDataDialog 
      v-model:visible="exportVisible"
      :data-count="capturedData.length"
      @export="handleExport" />

    <ConfirmDialog 
      v-model:visible="confirmVisible"
      :title="confirmConfig.title"
      :message="confirmConfig.message"
      :type="confirmConfig.type"
      :confirm-text="confirmConfig.confirmText"
      :cancel-text="confirmConfig.cancelText"
      @confirm="handleClearData" />
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import CertificateStatusDialog from './components/CertificateStatusDialog.vue'
import RequestDetailDialog from './components/RequestDetailDialog.vue'
import ExportDataDialog from './components/ExportDataDialog.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import { captureAPI, certificateAPI, proxyAPI } from './api'

export default {
  name: 'App',
  components: {
    CertificateStatusDialog,
    RequestDetailDialog,
    ExportDataDialog,
    ConfirmDialog
  },
  setup() {
    console.log('Vue 应用 setup 开始')
    
    // 响应式数据
    const isCapturing = ref(false)
    const captureLoading = ref(false)
    const certLoading = ref(false)
    const capturedData = ref([])
    const proxyPort = ref(7788)
    const runningTime = ref('00:00:00')
    const searchQuery = ref('')
    const filterProtocol = ref('')
    const startTime = ref(null)
    const timer = ref(null)

    // 证书相关状态
    const certStatusVisible = ref(false)
    const certStatusData = ref(null)
    const certStatus = ref({ installed: false })

    // 代理相关状态
    const proxyStatus = ref({ enabled: false, host: '', port: '' })

    // 请求详情相关状态
    const detailVisible = ref(false)
    const selectedRequest = ref(null)

    // 导出数据相关状态
    const exportVisible = ref(false)

    // 确认对话框相关状态
    const confirmVisible = ref(false)
    const confirmConfig = ref({
      title: '确认操作',
      message: '确定要执行此操作吗？',
      type: 'warning',
      confirmText: '确定',
      cancelText: '取消'
    })

    // 配置
    const config = ref({
      port: 7788,
      filter: ''
    })

    // 计算属性
    const filteredData = computed(() => {
      let data = capturedData.value
      
      if (searchQuery.value) {
        data = data.filter(item => 
          item.url.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
          item.host.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
          item.method.toLowerCase().includes(searchQuery.value.toLowerCase())
        )
      }
      
      if (filterProtocol.value) {
        data = data.filter(item => item.protocol === filterProtocol.value)
      }
      
      // 按时间戳倒序排列，最新的显示在最前面
      return data.sort((a, b) => {
        const timeA = new Date(a.timestamp || 0).getTime()
        const timeB = new Date(b.timestamp || 0).getTime()
        return timeB - timeA
      })
    })

    // 方法
    const startCapture = async () => {
      try {
        captureLoading.value = true
        
        // 创建一个可序列化的配置对象
        const serializableConfig = {
          port: config.value.port,
          filter: config.value.filter
        }
        
        console.log('发送配置:', serializableConfig)
        
        // 使用真实API调用
        const result = await captureAPI.startCapture(serializableConfig)
        
        if (result.success) {
          isCapturing.value = true
          startTime.value = Date.now()
          startTimer()
          proxyPort.value = config.value.port
          
          ElMessage.success(result.message)
          
          // 启动后刷新状态
          await refreshCertStatus()
          await refreshProxyStatus()
        } else {
          ElMessage.error(result.message)
        }
      } catch (error) {
        console.error('启动抓包错误:', error)
        ElMessage.error('启动抓包失败: ' + error.message)
      } finally {
        captureLoading.value = false
      }
    }

    const stopCapture = async () => {
      try {
        // 使用真实API调用
        const result = await captureAPI.stopCapture()
        
        if (result.success) {
          isCapturing.value = false
          stopTimer()
          ElMessage.success(result.message)
          
          // 停止后刷新代理状态
          await refreshProxyStatus()
        } else {
          ElMessage.error(result.message)
        }
      } catch (error) {
        ElMessage.error('停止抓包失败: ' + error.message)
      }
    }

    const showCertificateStatus = async () => {
      console.log('showCertificateStatus 被调用')
      certStatusVisible.value = true
      await refreshCertStatus()
    }

    const refreshCertStatus = async () => {
      try {
        // 使用真实API调用
        const result = await certificateAPI.getCertificateStatus()
        
        if (result.success) {
          certStatusData.value = result.data
          console.log('证书状态数据:', result.data)
          
          if (result.data.installed) {
            if (typeof result.data.installed === 'object' && result.data.installed.installed !== undefined) {
              certStatus.value = { installed: result.data.installed.installed }
            } else if (typeof result.data.installed === 'boolean') {
              certStatus.value = { installed: result.data.installed }
            } else {
              certStatus.value = { installed: false }
            }
          } else {
            certStatus.value = { installed: false }
          }
          
          console.log('设置证书状态为:', certStatus.value)
        } else {
          console.error('获取证书状态失败:', result.message)
          ElMessage.error('获取证书状态失败: ' + result.message)
        }
      } catch (error) {
        console.error('获取证书状态异常:', error)
        ElMessage.error('获取证书状态失败: ' + error.message)
      }
    }

    const refreshProxyStatus = async () => {
      try {
        // 使用真实API调用
        const result = await proxyAPI.getCurrentProxy()
        
        if (result.success) {
          if (result.data && result.data.httpProxy) {
            proxyStatus.value = {
              enabled: result.data.httpProxy.Enabled === 'Yes',
              host: result.data.httpProxy.Server || '',
              port: result.data.httpProxy.Port || ''
            }
          } else {
            proxyStatus.value = { enabled: false, host: '', port: '' }
          }
        } else {
          proxyStatus.value = { enabled: false, host: '', port: '' }
        }
      } catch (error) {
        console.error('获取代理状态失败:', error)
        proxyStatus.value = { enabled: false, host: '', port: '' }
      }
    }

    const setProxyManually = async () => {
      try {
        // 使用真实API调用
        const result = await proxyAPI.setProxy({ host: '127.0.0.1', port: config.value.port })
        
        if (result.success) {
          ElMessage.success(result.message)
          await refreshProxyStatus()
        } else {
          ElMessage.error(result.message)
        }
      } catch (error) {
        ElMessage.error('设置代理失败: ' + error.message)
      }
    }

    const installCertificate = async () => {
      try {
        certLoading.value = true
        console.log('开始安装证书...')
        
        // 使用真实API调用
        const result = await certificateAPI.installCertificate()
        
        if (result.success) {
          ElMessage.success(result.message)
          await refreshCertStatus()
        } else {
          ElMessage.error(result.message)
        }
      } catch (error) {
        console.error('证书安装异常:', error)
        ElMessage.error('安装证书失败: ' + error.message)
      } finally {
        certLoading.value = false
        console.log('证书安装完成，loading状态已清除')
      }
    }

    const openCertificateFile = async () => {
      try {
        // 使用真实API调用
        const result = await certificateAPI.openCertificateFile()
        
        if (result.success) {
          ElMessage.success(result.message)
        } else {
          ElMessage.error(result.message)
        }
      } catch (error) {
        ElMessage.error('打开证书文件失败: ' + error.message)
      }
    }

    const showExportDialog = () => {
      exportVisible.value = true
    }

    const handleExport = async (format) => {
      try {
        // 使用真实API调用
        console.log('handleExport 被调用', format)
        const result = await captureAPI.exportData(format)
        console.log('handleExport 结果', result)
        if (result.success) {
          ElMessage.success(result.message)
        } else {
          ElMessage.error(result.message)
        }
      } catch (error) {
        ElMessage.error('导出失败: ' + error.message)
      }
    }

    const showClearDataConfirm = () => {
      confirmConfig.value = {
        title: '确认清空',
        message: '确定要清空所有抓包数据吗？此操作不可恢复。',
        type: 'warning',
        confirmText: '确定',
        cancelText: '取消'
      }
      confirmVisible.value = true
    }

    const handleClearData = async () => {
      try {
        // 使用真实API调用
        const result = await captureAPI.clearCapturedData()
        
        if (result.success) {
          capturedData.value = []
          ElMessage.success(result.message)
        } else {
          ElMessage.error(result.message)
        }
      } catch (error) {
        ElMessage.error('清空数据失败: ' + error.message)
      }
    }

    const showDetail = (row) => {
      selectedRequest.value = row
      detailVisible.value = true
    }

    const formatTime = (timestamp) => {
      const date = new Date(timestamp)
      return date.toLocaleString('zh-CN')
    }

    const getMethodColor = (method) => {
      const colors = {
        'GET': 'success',
        'POST': 'warning',
        'PUT': 'info',
        'DELETE': 'danger',
        'PATCH': 'primary'
      }
      return colors[method] || 'info'
    }

    const getStatusColor = (statusCode) => {
      if (statusCode >= 200 && statusCode < 300) return 'success'
      if (statusCode >= 300 && statusCode < 400) return 'warning'
      if (statusCode >= 400 && statusCode < 500) return 'danger'
      if (statusCode >= 500) return 'danger'
      return 'info'
    }

    const startTimer = () => {
      timer.value = setInterval(() => {
        if (startTime.value) {
          const elapsed = Date.now() - startTime.value
          const hours = Math.floor(elapsed / 3600000)
          const minutes = Math.floor((elapsed % 3600000) / 60000)
          const seconds = Math.floor((elapsed % 60000) / 1000)
          runningTime.value = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        }
      }, 1000)
    }

    const stopTimer = () => {
      if (timer.value) {
        clearInterval(timer.value)
        timer.value = null
      }
      runningTime.value = '00:00:00'
    }

    const refreshData = async () => {
      try {
        // 使用真实API调用
        const result = await captureAPI.getCapturedData()
        
        if (result.success) {
          capturedData.value = result.data || []
        }
      } catch (error) {
        console.error('获取数据失败:', error)
      }
    }

    // 生命周期
    onMounted(() => {
      // 定期刷新数据
      const dataTimer = setInterval(refreshData, 1000)
      
      // 初始化证书状态
      refreshCertStatus()
      refreshProxyStatus()
      
      onUnmounted(() => {
        clearInterval(dataTimer)
        stopTimer()
      })
    })

    return {
      // 数据
      isCapturing,
      captureLoading,
      certLoading,
      capturedData,
      proxyPort,
      runningTime,
      searchQuery,
      filterProtocol,
      config,
      certStatusVisible,
      certStatusData,
      certStatus,
      proxyStatus,
      detailVisible,
      selectedRequest,
      exportVisible,
      confirmVisible,
      confirmConfig,

      // 计算属性
      filteredData,

      // 方法
      startCapture,
      stopCapture,
      showCertificateStatus,
      refreshCertStatus,
      installCertificate,
      openCertificateFile,
      refreshProxyStatus,
      setProxyManually,
      showExportDialog,
      handleExport,
      showClearDataConfirm,
      handleClearData,
      showDetail,
      formatTime,
      getMethodColor,
      getStatusColor
    }
  }
}
</script>

<style>
body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  background-color: #f5f7fa;
}

#app {
  height: 100vh;
}

.el-header {
  background-color: #fff;
  border-bottom: 1px solid #e4e7ed;
  padding: 0 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
}

.header-content h1 {
  margin: 0;
  color: #303133;
  font-size: 24px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.el-main {
  padding: 20px;
  background-color: #f5f7fa;
}

.status-card, .config-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  font-weight: 600;
  color: #303133;
}

.status-info p {
  margin: 10px 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-info strong {
  min-width: 100px;
  color: #606266;
}

.data-card {
  height: 100%;
}

.data-card .el-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.url-cell {
  max-width: 300px;
}

.url-text {
  word-break: break-all;
  color: #409eff;
  text-decoration: none;
}

.url-text:hover {
  text-decoration: underline;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .header-actions {
    flex-direction: column;
  }
  
  .url-text {
    max-width: 200px;
  }
}
</style>
