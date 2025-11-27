import React, { useState } from 'react';
import { Modal, Form, Radio, Alert, Button, Space } from 'antd';
import { ExportOutlined } from '@ant-design/icons';

interface ExportDataDialogProps {
  visible: boolean;
  dataCount: number;
  onCancel: () => void;
  onExport: (format: string) => void;
}

export const ExportDataDialog: React.FC<ExportDataDialogProps> = ({
  visible,
  dataCount,
  onCancel,
  onExport,
}) => {
  const [exportFormat, setExportFormat] = useState<string>('json');
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    try {
      setLoading(true);
      await onExport(exportFormat);
      onCancel();
    } catch (error) {
      console.error('导出失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <ExportOutlined />
          导出数据
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button
          key="export"
          type="primary"
          loading={loading}
          disabled={dataCount === 0}
          onClick={handleExport}
        >
          导出
        </Button>,
      ]}
      width={500}
    >
      <div style={{ padding: '10px 0' }}>
        <Alert
          message="导出说明"
          description={
            <div>
              <p>将导出 {dataCount} 条抓包数据</p>
              <p>支持 JSON 和 CSV 两种格式</p>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 20 }}
        />

        <Form layout="vertical">
          <Form.Item label="导出格式">
            <Radio.Group value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}>
              <Radio value="json">JSON 格式</Radio>
              <Radio value="csv">CSV 格式</Radio>
            </Radio.Group>
          </Form.Item>
        </Form>
      </div>
    </Modal>
  );
};
