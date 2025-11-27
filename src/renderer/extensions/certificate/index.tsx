import React, { useState, useEffect } from 'react';
import { Card, Button, Space, Descriptions, Alert, message } from 'antd';
import {
  SecurityScanOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';

interface CertificateStatus {
  installed: boolean;
  path: string;
  exists: boolean;
  validation?: {
    valid: boolean;
    message?: string;
  };
  info?: {
    subject?: string;
    issuer?: string;
    validFrom?: string;
    validTo?: string;
    fingerprint?: string;
  };
}

export const CertificatePanel: React.FC = () => {
  const [status, setStatus] = useState<CertificateStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    try {
      if (!window.electronAPI) return;
      const result = await window.electronAPI.certificate.getStatus();
      if (result.success) {
        setStatus(result.data);
      }
    } catch (error) {
      message.error('获取证书状态失败');
    }
  };

  const handleInstall = async () => {
    try {
      if (!window.electronAPI) return;
      setLoading(true);
      const result = await window.electronAPI.certificate.install();
      if (result.success) {
        message.success('证书安装成功');
        await fetchStatus();
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error('证书安装失败');
    } finally {
      setLoading(false);
    }
  };

  const handleUninstall = async () => {
    try {
      if (!window.electronAPI) return;
      setLoading(true);
      const result = await window.electronAPI.certificate.uninstall();
      if (result.success) {
        message.success('证书卸载成功');
        await fetchStatus();
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error('证书卸载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenFile = async () => {
    try {
      if (!window.electronAPI || !status?.path) return;
      const result = await window.electronAPI.system.showItemInFolder(status.path);
      if (!result.success) {
        message.error(result.message);
      }
    } catch (error) {
      message.error('打开所在文件夹失败');
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            <SecurityScanOutlined />
            证书管理
          </Space>
        }
        extra={<Button onClick={fetchStatus}>刷新状态</Button>}
      >
        {status && (
          <>
            <Alert
              message={status.installed ? '证书已安装' : '证书未安装'}
              description={
                status.installed
                  ? 'HTTPS 代理证书已成功安装到系统信任库'
                  : '需要安装证书才能拦截 HTTPS 请求'
              }
              type={status.installed ? 'success' : 'warning'}
              icon={status.installed ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
              style={{ marginBottom: 24 }}
            />

            <Descriptions bordered column={1}>
              <Descriptions.Item label="安装状态">
                {status.installed ? '已安装' : '未安装'}
              </Descriptions.Item>
              <Descriptions.Item label="证书文件">
                {status.exists ? '存在' : '不存在'}
              </Descriptions.Item>
              <Descriptions.Item label="文件路径">{status.path}</Descriptions.Item>
              {status.validation && (
                <Descriptions.Item label="证书有效性">
                  <Space>
                    {status.validation.valid ? (
                      <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    ) : (
                      <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
                    )}
                    {status.validation.valid ? '有效' : '无效'}
                    {status.validation.message && (
                      <span style={{ color: '#999' }}>({status.validation.message})</span>
                    )}
                  </Space>
                </Descriptions.Item>
              )}
              {status.info && (
                <>
                  <Descriptions.Item label="证书主体">
                    {status.info.subject || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="证书颁发者">
                    {status.info.issuer || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="有效期">
                    {status.info.validFrom && status.info.validTo
                      ? `${status.info.validFrom} 至 ${status.info.validTo}`
                      : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="指纹">
                    {status.info.fingerprint || '-'}
                  </Descriptions.Item>
                </>
              )}
            </Descriptions>

            <div style={{ marginTop: 24 }}>
              <Space>
                {!status.installed ? (
                  <Button type="primary" onClick={handleInstall} loading={loading}>
                    安装证书
                  </Button>
                ) : (
                  <Button danger onClick={handleUninstall} loading={loading}>
                    卸载证书
                  </Button>
                )}

                <Button onClick={handleOpenFile}>打开证书文件</Button>
              </Space>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};
