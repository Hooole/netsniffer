<template>
  <el-dialog 
    :model-value="visible" 
    title="证书状态" 
    width="70%" 
    :before-close="closeDialog" 
    @update:model-value="$emit('update:visible', $event)">
    
    <div v-if="certStatusData">
      <el-row :gutter="20">
        <el-col :span="12">
          <el-card>
            <template #header><span>📋 证书信息</span></template>
            <el-descriptions :column="1" border>
              <el-descriptions-item label="证书存在">
                <el-tag :type="certStatusData.exists ? 'success' : 'danger'">
                  {{ certStatusData.exists ? '是' : '否' }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="系统安装">
                <el-tag :type="certStatusData.installed && certStatusData.installed.installed ? 'success' : 'warning'">
                  {{ certStatusData.installed && certStatusData.installed.installed ? '已安装' : '未安装' }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="安装位置" v-if="certStatusData.installed && certStatusData.installed.location">
                {{ certStatusData.installed.location }}
              </el-descriptions-item>
              <el-descriptions-item label="证书有效性">
                <el-tag :type="certStatusData.validation && certStatusData.validation.valid ? 'success' : 'danger'">
                  {{ certStatusData.validation && certStatusData.validation.valid ? '有效' : '无效' }}
                </el-tag>
              </el-descriptions-item>
            </el-descriptions>
          </el-card>
        </el-col>
        <el-col :span="12">
          <el-card>
            <template #header><span>🔧 操作</span></template>
            <div style="display: flex; flex-direction: column; gap: 10px;">
              <el-button 
                type="primary" 
                @click="installCertificate" 
                :loading="loading" 
                :disabled="certStatusData.installed && certStatusData.installed.installed">
                📜 安装证书
              </el-button>
              <el-button 
                type="info" 
                @click="openCertificateFile" 
                :disabled="!certStatusData.exists">
                📁 打开证书文件
              </el-button>
              <el-button type="warning" @click="refreshStatus">
                🔄 刷新状态
              </el-button>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>
    
    <div v-else style="text-align: center; padding: 40px;">
      <el-empty description="加载中..." v-if="loading">
        <el-icon class="is-loading"><Loading /></el-icon>
      </el-empty>
      <el-empty description="暂无证书信息" v-else></el-empty>
    </div>
    
    <template #footer>
      <span style="text-align: right;">
        <el-button @click="closeDialog">关闭</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script>
export default {
  name: 'CertificateStatusDialog',
  props: {
    visible: { type: Boolean, default: false },
    certStatusData: { type: Object, default: null },
    loading: { type: Boolean, default: false }
  },
  emits: ['update:visible', 'refresh', 'install', 'open-file'],
  setup(props, { emit }) {
    const closeDialog = () => emit('update:visible', false)
    const refreshStatus = () => emit('refresh')
    const installCertificate = () => emit('install')
    const openCertificateFile = () => emit('open-file')
    
    return { 
      closeDialog, 
      refreshStatus, 
      installCertificate, 
      openCertificateFile 
    }
  }
}
</script>

<style scoped>
.el-descriptions-item__label {
  font-weight: 600;
}

.el-card__header {
  background-color: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;
}
</style> 