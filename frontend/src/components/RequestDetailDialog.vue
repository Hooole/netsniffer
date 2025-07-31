<template>
  <el-dialog 
    :model-value="visible" 
    title="请求详情" 
    width="90%" 
    :before-close="closeDialog" 
    @update:model-value="$emit('update:visible', $event)">
    
    <div v-if="request">
      <!-- 基本信息 -->
      <el-descriptions :column="2" border style="margin-bottom: 20px;">
        <el-descriptions-item label="时间">{{ formatTime(request.timestamp) }}</el-descriptions-item>
        <el-descriptions-item label="方法">{{ request.method }}</el-descriptions-item>
        <el-descriptions-item label="URL">{{ request.url }}</el-descriptions-item>
        <el-descriptions-item label="主机">{{ request.host }}</el-descriptions-item>
        <el-descriptions-item label="协议">{{ request.protocol }}</el-descriptions-item>
        <el-descriptions-item label="状态码">{{ request.statusCode || '-' }}</el-descriptions-item>
        <el-descriptions-item label="请求大小">{{ formatSize(request.requestBodySize) }}</el-descriptions-item>
        <el-descriptions-item label="响应大小">{{ formatSize(request.responseBodySize) }}</el-descriptions-item>
        <el-descriptions-item label="耗时">{{ request.duration ? `${request.duration}ms` : '-' }}</el-descriptions-item>
      </el-descriptions>

      <!-- 详细信息标签页 -->
      <el-tabs v-model="activeTab" type="border-card" @tab-change="handleTabChange">
        <!-- 请求头 -->
        <el-tab-pane label="请求头" name="requestHeaders">
          <div v-if="request.headers && Object.keys(request.headers).length > 0">
            <el-table 
              :data="headersToArray(request.headers)" 
              border 
              stripe
              :key="`request-headers-${request.timestamp}-${tableKey}`"
              max-height="400">
              <el-table-column prop="name" label="名称" width="200" />
              <el-table-column prop="value" label="值" show-overflow-tooltip />
            </el-table>
          </div>
          <el-empty v-else description="暂无请求头数据" />
        </el-tab-pane>

        <!-- 响应头 -->
        <el-tab-pane label="响应头" name="responseHeaders">
          <div v-if="request.responseHeaders && Object.keys(request.responseHeaders).length > 0">
            <el-table 
              :data="headersToArray(request.responseHeaders)" 
              border 
              stripe
              :key="`response-headers-${request.timestamp}-${tableKey}`"
              max-height="400">
              <el-table-column prop="name" label="名称" width="200" />
              <el-table-column prop="value" label="值" show-overflow-tooltip />
            </el-table>
          </div>
          <el-empty v-else description="暂无响应头数据" />
        </el-tab-pane>

        <!-- 请求体 -->
        <el-tab-pane label="请求体" name="requestBody">
          <div v-if="request.requestBody">
            <div style="margin-bottom: 10px;">
              <el-button size="small" @click="copyToClipboard(request.requestBody)">复制</el-button>
              <el-button size="small" @click="formatRequestBodyJson">格式化JSON</el-button>
            </div>
            <el-input
              v-model="formattedRequestBody"
              type="textarea"
              :rows="15"
              readonly
              placeholder="请求体内容"
            />
          </div>
          <el-empty v-else description="暂无请求体数据" />
        </el-tab-pane>

        <!-- 响应体 -->
        <el-tab-pane label="响应体" name="responseBody">
          <div v-if="request.responseBody">
            <div style="margin-bottom: 10px;">
              <el-button size="small" @click="copyToClipboard(request.responseBody)">复制</el-button>
              <el-button size="small" @click="formatResponseBodyJson">格式化JSON</el-button>
            </div>
            <el-input
              v-model="formattedResponseBody"
              type="textarea"
              :rows="15"
              readonly
              placeholder="响应体内容"
            />
          </div>
          <el-empty v-else description="暂无响应体数据" />
        </el-tab-pane>
      </el-tabs>
    </div>
    
    <div v-else style="text-align: center; padding: 40px;">
      <el-empty description="暂无请求信息"></el-empty>
    </div>
    
    <template #footer>
      <span style="text-align: right;">
        <el-button @click="closeDialog">关闭</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script>
import { ref, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'

export default {
  name: 'RequestDetailDialog',
  props: {
    visible: { type: Boolean, default: false },
    request: { type: Object, default: null }
  },
  emits: ['update:visible'],
  setup(props, { emit }) {
    const activeTab = ref('requestHeaders')
    const formattedRequestBody = ref('')
    const formattedResponseBody = ref('')
    const tableKey = ref(0)
    console.log('formatRequestBodyJson() 被调用', JSON.stringify(props.request));
    console.log('formattedRequestBody', JSON.stringify(props.request));
    // 处理标签页切换
    const handleTabChange = async (tabName) => {
      activeTab.value = tabName
      // 使用 nextTick 确保 DOM 更新完成后再渲染表格
      await nextTick()
      tableKey.value++
    }

    const closeDialog = () => {
      emit('update:visible', false)
    }
    
    const formatTime = (timestamp) => {
      const date = new Date(timestamp)
      return date.toLocaleString('zh-CN')
    }

    const formatSize = (size) => {
      if (!size) return '-'
      if (size < 1024) return `${size}B`
      if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`
      return `${(size / (1024 * 1024)).toFixed(1)}MB`
    }

    const headersToArray = (headers) => {
      if (!headers || typeof headers !== 'object') return []
      return Object.entries(headers).map(([name, value]) => ({
        name,
        value: Array.isArray(value) ? value.join(', ') : String(value)
      }))
    }

    const copyToClipboard = async (text) => {
      try {
        await navigator.clipboard.writeText(text)
        ElMessage.success('已复制到剪贴板')
      } catch (error) {
        ElMessage.error('复制失败')
      }
    }

    const formatJson = (text) => {
      try {
        const parsed = JSON.parse(text)
        return JSON.stringify(parsed, null, 2)
      } catch (error) {
        return text
      }
    }

    const formatRequestBodyJson = () => {
     
      if (props.request?.requestBody) {
        formattedRequestBody.value = formatJson(props.request.requestBody)
      }
    }

    const formatResponseBodyJson = () => {
      if (props.request?.responseBody) {
        formattedResponseBody.value = formatJson(props.request.responseBody)
      }
    }

    // 监听请求数据变化，格式化请求体和响应体
    watch(() => props.request, (newRequest) => {
      if (newRequest) {
        formattedRequestBody.value = newRequest.requestBody || ''
        formattedResponseBody.value = newRequest.responseBody || ''
      }
    }, { immediate: true })

    return { 
      closeDialog, 
      formatTime, 
      formatSize,
      headersToArray,
      copyToClipboard,
      formatJson,
      formatRequestBodyJson,
      formatResponseBodyJson,
      activeTab,
      formattedRequestBody,
      formattedResponseBody,
      handleTabChange,
      tableKey
    }
  }
}
</script>

<style scoped>
.el-descriptions-item__label {
  font-weight: 600;
}

.el-tabs {
  margin-top: 20px;
}

.el-table {
  margin-top: 10px;
}

.el-input {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
}
</style> 