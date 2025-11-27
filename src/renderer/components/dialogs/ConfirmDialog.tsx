import React from 'react';
import { Modal, Space } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  content: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLoading?: boolean;
  type?: 'warning' | 'danger' | 'info';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  title,
  content,
  onCancel,
  onConfirm,
  confirmLoading = false,
  type = 'warning',
}) => {
  const getIcon = () => {
    switch (type) {
      case 'warning':
        return <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
      case 'danger':
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'info':
        return <ExclamationCircleOutlined style={{ color: '#1890ff' }} />;
      default:
        return <ExclamationCircleOutlined />;
    }
  };

  return (
    <Modal
      title={
        <Space>
          {getIcon()}
          {title}
        </Space>
      }
      open={visible}
      onOk={onConfirm}
      onCancel={onCancel}
      confirmLoading={confirmLoading}
      okText="确认"
      cancelText="取消"
      okType={type === 'danger' ? 'danger' : 'primary'}
    >
      <div style={{ marginLeft: 22 }}>{content}</div>
    </Modal>
  );
};
