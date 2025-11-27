import React, { useState } from 'react';
import { Button, InputNumber, Input, Popover, Badge, message } from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  DeleteOutlined,
  ExportOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useProxyStore } from '../../store/proxy-store';
import { useCaptureStore } from '../../store/capture-store';
import { ExportDataDialog, ConfirmDialog } from '../dialogs';

interface ToolbarProps {
  onStartProxy: (config: any) => void;
  onStopProxy: () => void;
  onClearData: () => void;
  onExportData: (format: string) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  onStartProxy,
  onStopProxy,
  onClearData,
  onExportData,
}) => {
  const { isRunning, config } = useProxyStore();
  const { capturedData } = useCaptureStore();
  const [proxyConfig, setProxyConfig] = useState({
    port: 7890,
    host: '127.0.0.1',
    enableCapture: true,
    enableHttps: true,
    filter: '',
  });

  // 对话框状态
  const [exportDialogVisible, setExportDialogVisible] = useState(false);
  const [clearDialogVisible, setClearDialogVisible] = useState(false);

  const handleStart = () => {
    onStartProxy(proxyConfig);
  };

  const handleStop = () => {
    onStopProxy();
  };

  const handleExport = async (format: string) => {
    try {
      await onExportData(format);
      message.success('数据导出成功');
    } catch (error) {
      message.error('数据导出失败');
    }
  };

  const handleClearData = () => {
    onClearData();
    setClearDialogVisible(false);
  };

  const settingsContent = (
    <div style={{ width: 300, padding: 8 }}>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>代理端口</label>
        <InputNumber
          style={{ width: '100%' }}
          min={1024}
          max={65535}
          value={proxyConfig.port}
          onChange={(value) => setProxyConfig({ ...proxyConfig, port: value || 7890 })}
          disabled={isRunning}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>监听地址</label>
        <Input
          value={proxyConfig.host}
          onChange={(e) => setProxyConfig({ ...proxyConfig, host: e.target.value })}
          disabled={isRunning}
          placeholder="127.0.0.1"
        />
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>过滤规则</label>
        <Input
          value={proxyConfig.filter}
          onChange={(e) => setProxyConfig({ ...proxyConfig, filter: e.target.value })}
          placeholder="例如: *.example.com"
        />
      </div>
    </div>
  );

  return (
    <div className="netsniffer-toolbar">
      {/* 代理控制 */}
      <div className="toolbar-group">
        <div className="status-indicator">
          <div className={`status-dot ${isRunning ? 'running' : 'stopped'}`} />
          <span>{isRunning ? '运行中' : '已停止'}</span>
        </div>

        {!isRunning ? (
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleStart}>
            启动抓包
          </Button>
        ) : (
          <Button danger icon={<PauseCircleOutlined />} onClick={handleStop}>
            停止抓包
          </Button>
        )}

        <Popover content={settingsContent} title="代理设置" trigger="click" placement="bottomLeft">
          <Button icon={<SettingOutlined />} disabled={isRunning}>
            设置
          </Button>
        </Popover>
      </div>

      {/* 数据操作 */}
      <div className="toolbar-group">
        <div style={{ marginRight: 24 }}>
          <Badge count={capturedData.length} showZero>
            <span style={{ marginRight: 8 }}>抓包数据</span>
          </Badge>
        </div>

        <Button
          icon={<ExportOutlined />}
          onClick={() => setExportDialogVisible(true)}
          disabled={capturedData.length === 0}
        >
          导出
        </Button>

        <Button
          icon={<DeleteOutlined />}
          onClick={() => setClearDialogVisible(true)}
          disabled={capturedData.length === 0}
        >
          清空
        </Button>
      </div>

      {/* 对话框 */}
      <ExportDataDialog
        visible={exportDialogVisible}
        dataCount={capturedData.length}
        onCancel={() => setExportDialogVisible(false)}
        onExport={handleExport}
      />

      <ConfirmDialog
        visible={clearDialogVisible}
        title="确认清空数据"
        content={`确定要清空所有 ${capturedData.length} 条抓包数据吗？此操作不可撤销。`}
        onCancel={() => setClearDialogVisible(false)}
        onConfirm={handleClearData}
        type="danger"
      />
    </div>
  );
};
