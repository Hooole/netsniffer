import React, { useState } from 'react';
import { Modal, Descriptions, Tabs, Table, Empty, Tag, Space, Typography } from 'antd';
import { InfoCircleOutlined, CodeOutlined } from '@ant-design/icons';

const { Text, Paragraph } = Typography;

interface CapturedRequest {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  host: string;
  protocol: string;
  statusCode?: number;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBody?: string;
  responseBody?: string;
  duration?: number;
}

interface RequestDetailDialogProps {
  visible: boolean;
  request: CapturedRequest | null;
  onCancel: () => void;
}

export const RequestDetailDialog: React.FC<RequestDetailDialogProps> = ({
  visible,
  request,
  onCancel,
}) => {
  const [activeTab, setActiveTab] = useState('overview');

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  const formatSize = (size?: number) => {
    if (!size) return '-';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const headersToArray = (headers: Record<string, string>) => {
    return Object.entries(headers).map(([name, value]) => ({
      key: name,
      name,
      value,
    }));
  };

  const formatBody = (body: string | undefined, contentType?: string) => {
    if (!body) return '';

    try {
      // 尝试格式化JSON
      if (contentType?.includes('application/json') || body.trim().startsWith('{')) {
        return JSON.stringify(JSON.parse(body), null, 2);
      }
      return body;
    } catch {
      return body;
    }
  };

  const getStatusColor = (statusCode?: number) => {
    if (!statusCode) return 'default';
    if (statusCode >= 200 && statusCode < 300) return 'success';
    if (statusCode >= 300 && statusCode < 400) return 'warning';
    if (statusCode >= 400) return 'error';
    return 'default';
  };

  const items = [
    {
      key: 'overview',
      label: '概览',
      children: request ? (
        <Descriptions bordered column={2}>
          <Descriptions.Item label="时间" span={2}>
            {formatTime(request.timestamp)}
          </Descriptions.Item>
          <Descriptions.Item label="方法">
            <Tag color="blue">{request.method}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="状态码">
            <Tag color={getStatusColor(request.statusCode)}>{request.statusCode || '-'}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="URL" span={2}>
            <Text copyable ellipsis style={{ maxWidth: 400 }}>
              {request.url}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="主机">{request.host}</Descriptions.Item>
          <Descriptions.Item label="协议">
            <Tag>{request.protocol.toUpperCase()}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="耗时">
            {request.duration ? `${request.duration}ms` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="请求大小">
            {formatSize(request.requestBody?.length)}
          </Descriptions.Item>
          <Descriptions.Item label="响应大小">
            {formatSize(request.responseBody?.length)}
          </Descriptions.Item>
        </Descriptions>
      ) : null,
    },
    {
      key: 'requestHeaders',
      label: '请求头',
      children:
        request?.requestHeaders && Object.keys(request.requestHeaders).length > 0 ? (
          <Table
            dataSource={headersToArray(request.requestHeaders)}
            pagination={false}
            size="small"
            scroll={{ y: 400 }}
          >
            <Table.Column
              title="名称"
              dataIndex="name"
              key="name"
              width={200}
              render={(text) => <Text strong>{text}</Text>}
            />
            <Table.Column
              title="值"
              dataIndex="value"
              key="value"
              ellipsis={{ showTitle: false }}
              render={(text) => <Text copyable>{text}</Text>}
            />
          </Table>
        ) : (
          <Empty description="暂无请求头数据" />
        ),
    },
    {
      key: 'responseHeaders',
      label: '响应头',
      children:
        request?.responseHeaders && Object.keys(request.responseHeaders).length > 0 ? (
          <Table
            dataSource={headersToArray(request.responseHeaders)}
            pagination={false}
            size="small"
            scroll={{ y: 400 }}
          >
            <Table.Column
              title="名称"
              dataIndex="name"
              key="name"
              width={200}
              render={(text) => <Text strong>{text}</Text>}
            />
            <Table.Column
              title="值"
              dataIndex="value"
              key="value"
              ellipsis={{ showTitle: false }}
              render={(text) => <Text copyable>{text}</Text>}
            />
          </Table>
        ) : (
          <Empty description="暂无响应头数据" />
        ),
    },
    {
      key: 'requestBody',
      label: '请求体',
      children: request?.requestBody ? (
        <div>
          <div style={{ marginBottom: 10 }}>
            <Space>
              <Text type="secondary">大小: {formatSize(request.requestBody.length)}</Text>
              <Text type="secondary">类型: {request.requestHeaders?.['content-type'] || '-'}</Text>
            </Space>
          </div>
          <Paragraph
            code
            copyable
            style={{
              backgroundColor: '#f5f5f5',
              padding: 12,
              borderRadius: 4,
              maxHeight: 400,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {formatBody(request.requestBody, request.requestHeaders?.['content-type'])}
          </Paragraph>
        </div>
      ) : (
        <Empty description="暂无请求体数据" />
      ),
    },
    {
      key: 'responseBody',
      label: '响应体',
      children: request?.responseBody ? (
        <div>
          <div style={{ marginBottom: 10 }}>
            <Space>
              <Text type="secondary">大小: {formatSize(request.responseBody.length)}</Text>
              <Text type="secondary">类型: {request.responseHeaders?.['content-type'] || '-'}</Text>
            </Space>
          </div>
          <Paragraph
            code
            copyable
            style={{
              backgroundColor: '#f5f5f5',
              padding: 12,
              borderRadius: 4,
              maxHeight: 400,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {formatBody(request.responseBody, request.responseHeaders?.['content-type'])}
          </Paragraph>
        </div>
      ) : (
        <Empty description="暂无响应体数据" />
      ),
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <InfoCircleOutlined />
          请求详情
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      footer={null}
      width="90%"
      style={{ top: 20 }}
    >
      {request && <Tabs activeKey={activeTab} onChange={setActiveTab} items={items} size="small" />}
    </Modal>
  );
};
