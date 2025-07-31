<template>
  <el-dialog 
    :model-value="visible" 
    title="导出数据" 
    width="500px" 
    :before-close="closeDialog" 
    @update:model-value="$emit('update:visible', $event)">
    
    <div style="padding: 10px 0;">
      <el-alert title="导出说明" type="info" :closable="false" style="margin-bottom: 20px;">
        <p>将导出 {{ dataCount }} 条抓包数据</p>
        <p>支持 JSON 和 CSV 两种格式</p>
      </el-alert>
      
      <el-form label-width="100px">
        <el-form-item label="导出格式">
          <el-radio-group v-model="exportFormat">
            <el-radio label="json">JSON 格式</el-radio>
            <el-radio label="csv">CSV 格式</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
    </div>
    
    <template #footer>
      <span style="text-align: right;">
        <el-button @click="closeDialog">取消</el-button>
        <el-button 
          type="primary" 
          @click="handleExport" 
          :loading="loading" 
          :disabled="dataCount === 0">
          导出
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script>
import { ref } from 'vue'

export default {
  name: 'ExportDataDialog',
  props: {
    visible: { type: Boolean, default: false },
    dataCount: { type: Number, default: 0 }
  },
  emits: ['update:visible', 'export'],
  setup(props, { emit }) {
    const exportFormat = ref('json')
    const loading = ref(false)
    
    const closeDialog = () => emit('update:visible', false)
    
    const handleExport = () => {
      loading.value = true
      try {
        emit('export', exportFormat.value)
        closeDialog()
      } catch (error) {
        console.error('导出失败:', error)
      } finally {
        loading.value = false
      }
    }
    
    return { 
      exportFormat, 
      loading, 
      closeDialog, 
      handleExport 
    }
  }
}
</script> 