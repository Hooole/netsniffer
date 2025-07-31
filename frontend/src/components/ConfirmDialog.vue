<template>
  <el-dialog 
    :model-value="visible" 
    :title="title" 
    width="400px" 
    :before-close="closeDialog" 
    @update:model-value="$emit('update:visible', $event)">
    
    <div style="text-align: center;">
      <el-alert :title="message" :type="type" :closable="false" show-icon></el-alert>
    </div>
    
    <template #footer>
      <span style="text-align: right;">
        <el-button @click="handleCancel">{{ cancelText }}</el-button>
        <el-button 
          :type="type === 'danger' ? 'danger' : 'primary'" 
          @click="handleConfirm" 
          :loading="loading">
          {{ confirmText }}
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script>
import { ref } from 'vue'

export default {
  name: 'ConfirmDialog',
  props: {
    visible: { type: Boolean, default: false },
    title: { type: String, default: '确认操作' },
    message: { type: String, default: '确定要执行此操作吗？' },
    type: { type: String, default: 'warning' },
    confirmText: { type: String, default: '确定' },
    cancelText: { type: String, default: '取消' }
  },
  emits: ['update:visible', 'confirm', 'cancel'],
  setup(props, { emit }) {
    const loading = ref(false)
    
    const closeDialog = () => emit('update:visible', false)
    
    const handleConfirm = () => {
      loading.value = true
      try {
        emit('confirm')
        closeDialog()
      } catch (error) {
        console.error('确认操作失败:', error)
      } finally {
        loading.value = false
      }
    }
    
    const handleCancel = () => {
      emit('cancel')
      closeDialog()
    }
    
    return { 
      loading, 
      closeDialog, 
      handleConfirm, 
      handleCancel 
    }
  }
}
</script> 