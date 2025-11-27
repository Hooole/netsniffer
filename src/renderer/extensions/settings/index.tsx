import React, { useMemo, useState, useEffect } from 'react';
import {
  List,
  Button,
  InputNumber,
  Tag,
  Card,
  Typography,
  message,
  Space,
  Divider,
  Popconfirm,
  Switch,
} from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { useProxyStore } from '../../store/proxy-store';
import { useCaptureStore } from '../../store/capture-store';

const { Title, Text } = Typography;

export const SettingsPanel: React.FC = () => {
  const proxyStore = useProxyStore();
  const captureStore = useCaptureStore();

  const initialConfig = useMemo(
    () => ({
      port: proxyStore.config?.port || 7890,
      host: proxyStore.config?.host || '127.0.0.1',
      enableCapture: true,
      enableHttps: true,
      filter: proxyStore.config?.filter || '',
    }),
    [proxyStore.config]
  );

  const [config, setConfig] = useState(initialConfig);

  // 仅设置系统代理，不启动/停止 whistle
  const startProxy = async () => {
    try {
      if (!window.electronAPI) return;
      const result = await window.electronAPI.proxy.setSystemProxy({
        host: config.host,
        port: config.port,
      });
      if (result.success) {
        message.success('系统代理已开启');
      } else {
        message.error(result.message);
      }
    } catch (error) {
      console.error('Failed to set system proxy:', error);
      message.error('设置系统代理失败');
    }
  };

  const stopProxy = async () => {
    try {
      if (!window.electronAPI) return;
      const result = await window.electronAPI.proxy.clearSystemProxy();
      if (result.success) {
        message.success('系统代理已关闭');
      } else {
        message.error(result.message);
      }
    } catch (error) {
      console.error('Failed to clear system proxy:', error);
      message.error('清除系统代理失败');
    }
  };

  const [isProxyOn, setIsProxyOn] = useState<boolean>(false);
  const [switchLoading, setSwitchLoading] = useState<boolean>(false);

  const refreshSystemProxyStatus = async () => {
    try {
      console.log('refreshSystemProxyStatus', window.electronAPI);
      if (!window.electronAPI) return;
      const ret = await window.electronAPI.proxy.getSystemProxyStatus();
      console.log('ret嘎哈', ret);
      if (ret && ret.success) {
        setIsProxyOn(Boolean(ret.enabled));
      }
    } catch {}
  };

  useEffect(() => {
    refreshSystemProxyStatus();
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <Card style={{ marginBottom: 16 }}>
        <Space align="center" size={12} wrap>
          <SettingOutlined />
          <Title level={4} style={{ margin: 0 }}>
            设置
          </Title>
          <Tag color={isProxyOn ? 'green' : 'default'}>
            {isProxyOn ? '代理已开启' : '代理未开启'}
          </Tag>
          <Divider type="vertical" />
          <Text type="secondary">已捕获 {captureStore.capturedData.length} 条</Text>
        </Space>
      </Card>

      <Card bordered>
        <List itemLayout="horizontal">
          <List.Item
            actions={[
              <Switch
                key="proxy-switch"
                checked={isProxyOn}
                checkedChildren="已开启"
                unCheckedChildren="已关闭"
                loading={switchLoading}
                onChange={async (checked) => {
                  setSwitchLoading(true);
                  try {
                    if (checked) {
                      await startProxy();
                    } else {
                      await stopProxy();
                    }
                    await refreshSystemProxyStatus();
                  } finally {
                    setSwitchLoading(false);
                  }
                }}
              />,
            ]}
          >
            <List.Item.Meta
              title="代理状态"
              description={
                <Text type="secondary">
                  {isProxyOn ? '系统代理已开启（HTTP/HTTPS）' : '系统代理未开启'}
                </Text>
              }
            />
          </List.Item>

          <List.Item
            actions={[
              <Popconfirm
                key="clear"
                title={`确定清空全部 ${captureStore.capturedData.length} 条数据？`}
                okText="清空"
                cancelText="取消"
                okButtonProps={{ danger: true }}
                onConfirm={async () => {
                  try {
                    if (!window.electronAPI) return;
                    const result = await window.electronAPI.capture.clearCapturedData();
                    if (result.success) {
                      captureStore.clearData();
                      message.success('数据已清空');
                    } else {
                      message.error(result.message);
                    }
                  } catch (error) {
                    message.error('清空数据失败');
                  }
                }}
              >
                <Button danger>清空</Button>
              </Popconfirm>,
            ]}
          >
            <List.Item.Meta
              title="抓包数据"
              description={
                <Text type="secondary">当前共有 {captureStore.capturedData.length} 条数据</Text>
              }
            />
          </List.Item>

          <List.Item>
            <List.Item.Meta title="代理端口" description="本地代理监听端口" />
            <div style={{ width: 200 }}>
              <InputNumber
                style={{ width: '100%' }}
                min={1024}
                max={65535}
                value={config.port}
                onChange={(v) => setConfig({ ...config, port: v || 7890 })}
                disabled={isProxyOn}
              />
            </div>
          </List.Item>

          {/* <List.Item>
            <List.Item.Meta title="监听地址" description="通常保持 127.0.0.1 即可" />
            <div style={{ width: 240 }}>
              <Input
                value={config.host}
                onChange={(e) => setConfig({ ...config, host: e.target.value })}
                disabled={isRunning}
              />
            </div>
          </List.Item> */}

          {/* <List.Item>
            <List.Item.Meta title="过滤规则" description="支持通配符，例如 *.example.com" />
            <div style={{ width: 320 }}>
              <Input
                placeholder="例如: *.example.com"
                value={config.filter}
                onChange={(e) => setConfig({ ...config, filter: e.target.value })}
              />
            </div>
          </List.Item> */}
        </List>
      </Card>
    </div>
  );
};
