import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Table, Input, Select, Space, Tag, Button, Empty, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SearchOutlined, EyeOutlined, ExportOutlined } from '@ant-design/icons';
import { useCaptureStore } from '../../store/capture-store';
import { RequestDetailDialog, ExportDataDialog } from '../../components/dialogs';
import type { CapturedRequest } from '../../store/capture-store';

const { Option } = Select;

export const CapturePanel: React.FC = () => {
  // 订阅筛选器与派发动作
  const { setFilters, setSelectedRequest } = useCaptureStore();
  const filters = useCaptureStore((s) => s.filters);
  const capturedData = useCaptureStore((s) => s.capturedData);
  const computeFiltered = useCaptureStore((s) => s.getFilteredData);

  // 基于最新 store 状态计算，避免闭包老数据
  const filteredData = useMemo(() => {
    const result = computeFiltered();
    console.log('🔄 Computing filtered data:', {
      total: capturedData.length,
      filtered: result.length,
      filters,
    });
    return result;
  }, [capturedData, filters, computeFiltered]);

  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedReq, setSelectedReq] = useState<CapturedRequest | null>(null);
  const [exportDialogVisible, setExportDialogVisible] = useState(false);
  const pollRef = useRef<number | null>(null);

  // 调试信息
  useEffect(() => {
    console.log('📊 CapturePanel render:', {
      capturedDataLength: capturedData.length,
      filteredDataLength: filteredData.length,
      filters,
    });
  }, [capturedData.length, filteredData.length, filters]);

  // 使用新的拉取快照接口进行轮询（5s）
  useEffect(() => {
    const start = () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      pollRef.current = window.setInterval(async () => {
        try {
          if (!window.electronAPI) return;
          const res = await window.electronAPI.capture.fetchWhistleSnapshot?.();
          if (res?.success && Array.isArray(res.data)) {
            useCaptureStore.getState().setCapturedData(res.data as CapturedRequest[]);
          }
        } catch {}
      }, 5000);
    };
    start();
    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

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

  const columns: ColumnsType<CapturedRequest> = [
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
      render: (url: string) => <span style={{ color: '#1890ff' }}>{url}</span>,
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      width: 80,
      render: (duration?: number) => (duration ? `${duration}ms` : '-'),
    },
    {
      title: '操作',
      width: 80,
      render: (_value: unknown, record: CapturedRequest) => (
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
      <div
        style={{
          padding: 16,
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
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

        <div>
          <Button
            icon={<ExportOutlined />}
            onClick={() => setExportDialogVisible(true)}
            disabled={capturedData.length === 0}
          >
            导出
          </Button>
        </div>
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
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          }}
          onRow={(record) => ({
            onClick: () => handleRowClick(record),
            style: { cursor: 'pointer' },
          })}
          scroll={{ y: 'calc(100vh - 260px)' }}
          locale={{
            emptyText: (
              <Empty
                description={
                  <span>
                    {capturedData.length === 0
                      ? '暂无抓包数据，请先启动抓包服务'
                      : '没有匹配的请求数据'}
                  </span>
                }
              />
            ),
          }}
        />
      </div>

      {/* 详情对话框 */}
      <RequestDetailDialog
        visible={detailVisible}
        request={selectedReq}
        onCancel={() => setDetailVisible(false)}
      />

      {/* 导出对话框 */}
      <ExportDataDialog
        visible={exportDialogVisible}
        dataCount={capturedData.length}
        onCancel={() => setExportDialogVisible(false)}
        onExport={async (format: string) => {
          try {
            if (!window.electronAPI) return;
            const result = await window.electronAPI.capture.exportData(format);
            if (result.success) {
              message.success('数据导出成功');
            } else {
              message.error(result.message);
            }
          } catch (error) {
            message.error('导出数据失败');
          }
        }}
      />
    </div>
  );
};
