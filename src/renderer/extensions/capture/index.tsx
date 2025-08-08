import React, { useState } from 'react';
import { Table, Input, Select, Space, Tag, Button } from 'antd';
import { SearchOutlined, EyeOutlined } from '@ant-design/icons';
import { useCaptureStore } from '../../store/capture-store';
import { RequestDetailDialog } from '../../components/dialogs';
import type { CapturedRequest } from '../../store/capture-store';

const { Option } = Select;

export const CapturePanel: React.FC = () => {
  const { filters, setFilters, getFilteredData, setSelectedRequest } = useCaptureStore();
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedReq, setSelectedReq] = useState<CapturedRequest | null>(null);
  
  const filteredData = getFilteredData();

  const handleRowClick = (record: CapturedRequest) => {
    setSelectedReq(record);
    setSelectedRequest(record);
    setDetailVisible(true);
  };

  const getMethodTag = (method: string) => {
    const colorMap: Record<string, string> = {
      GET: 'green',
      POST: 'blue',
      PUT: 'orange',
      DELETE: 'red',
      PATCH: 'purple',
    };
    return <Tag color={colorMap[method] || 'default'}>{method}</Tag>;
  };

  const getStatusTag = (statusCode?: number) => {
    if (!statusCode) return <Tag>-</Tag>;
    
    let color = 'default';
    if (statusCode >= 200 && statusCode < 300) color = 'green';
    else if (statusCode >= 300 && statusCode < 400) color = 'orange';
    else if (statusCode >= 400) color = 'red';
    
    return <Tag color={color}>{statusCode}</Tag>;
  };

  const columns = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      width: 160,
      render: (timestamp: string) => new Date(timestamp).toLocaleTimeString(),
    },
    {
      title: '方法',
      dataIndex: 'method',
      width: 80,
      render: getMethodTag,
    },
    {
      title: '状态',
      dataIndex: 'statusCode',
      width: 80,
      render: getStatusTag,
    },
    {
      title: '协议',
      dataIndex: 'protocol',
      width: 80,
      render: (protocol: string) => protocol.toUpperCase(),
    },
    {
      title: '主机',
      dataIndex: 'host',
      width: 180,
      ellipsis: true,
    },
    {
      title: 'URL',
      dataIndex: 'url',
      ellipsis: true,
      render: (url: string) => (
        <span style={{ color: '#1890ff' }}>{url}</span>
      ),
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      width: 80,
      render: (duration?: number) => duration ? `${duration}ms` : '-',
    },
    {
      title: '操作',
      width: 80,
      render: (_: any, record: CapturedRequest) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            handleRowClick(record);
          }}
        >
          查看
        </Button>
      ),
    },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 过滤器 */}
      <div style={{ padding: 16, borderBottom: '1px solid #f0f0f0' }}>
        <Space wrap>
          <Input
            placeholder="搜索URL、主机或方法"
            prefix={<SearchOutlined />}
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
            style={{ width: 250 }}
          />
          
          <Select
            placeholder="请求方法"
            value={filters.method || undefined}
            onChange={(value) => setFilters({ method: value || '' })}
            style={{ width: 120 }}
            allowClear
          >
            <Option value="GET">GET</Option>
            <Option value="POST">POST</Option>
            <Option value="PUT">PUT</Option>
            <Option value="DELETE">DELETE</Option>
            <Option value="PATCH">PATCH</Option>
          </Select>
          
          <Select
            placeholder="协议"
            value={filters.protocol || undefined}
            onChange={(value) => setFilters({ protocol: value || '' })}
            style={{ width: 100 }}
            allowClear
          >
            <Option value="http">HTTP</Option>
            <Option value="https">HTTPS</Option>
          </Select>
          
          <Select
            placeholder="状态码"
            value={filters.status || undefined}
            onChange={(value) => setFilters({ status: value || '' })}
            style={{ width: 120 }}
            allowClear
          >
            <Option value="2xx">2xx 成功</Option>
            <Option value="3xx">3xx 重定向</Option>
            <Option value="4xx">4xx 客户端错误</Option>
            <Option value="5xx">5xx 服务器错误</Option>
          </Select>
        </Space>
      </div>

      {/* 数据表格 */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          size="small"
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          }}
          onRow={(record) => ({
            onClick: () => handleRowClick(record),
            style: { cursor: 'pointer' },
          })}
          scroll={{ y: 'calc(100vh - 280px)' }}
        />
      </div>

      {/* 详情对话框 */}
      <RequestDetailDialog
        visible={detailVisible}
        request={selectedReq}
        onCancel={() => setDetailVisible(false)}
      />
    </div>
  );
};