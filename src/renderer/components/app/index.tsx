import React, { useState, useEffect } from 'react';
import { Layout, message } from 'antd';
import { Provider } from '../extensions/provider';
// import { Toolbar } from '../toolbar';
import { Sidebar } from '../sidebar';
import { ContentArea } from '../content-area';
import { StatusBar } from '../status-bar';
import { useProxyStore } from '../../store/proxy-store';
import { useCaptureStore } from '../../store/capture-store';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

const { Header, Content, Footer } = Layout;

export const App: React.FC = () => {
  const [activePanel, setActivePanel] = useState('capture');
  const proxyStore = useProxyStore();
  const captureStore = useCaptureStore();
  const location = useLocation();

  useEffect(() => {
    // 检查electronAPI是否可用
    console.log('window.electronAPI:', window.electronAPI);
    console.log('window.electronAPI.proxy:', window.electronAPI?.proxy);

    if (!window.electronAPI) {
      console.error('electronAPI is not available!');
      message.error('应用初始化失败：API不可用');
      return;
    }

    // 初始化数据
    initializeApp();

    // 监听数据更新（使用全局 store，避免闭包旧引用）
    console.log('🔧 Setting up data update listener...');
    const removeDataListener = window.electronAPI.capture.onDataUpdate((data) => {
      console.log('📡 Received dataUpdate event from main process:', data);
      const setCaptured = useCaptureStore.getState().setCapturedData;
      console.log('setCaptured', data);
      setCaptured(data || []);
    });
    console.log('✅ Data update listener set up successfully');

    return () => {
      console.log('🧹 Cleaning up data update listener...');
      removeDataListener();
    };
  }, []);

  const initializeApp = async () => {
    try {
      if (!window.electronAPI) {
        throw new Error('electronAPI is not available');
      }

      // 获取代理状态
      const proxyResult = await window.electronAPI.proxy.getStatus();
      if (proxyResult.success) {
        proxyStore.setStatus(proxyResult.data);
      }

      // 获取抓包数据
      const captureResult = await window.electronAPI.capture.getCapturedData();
      console.log('captureResult', captureResult);
      if (captureResult.success) {
        captureStore.setCapturedData(captureResult.data || []);
      }
    } catch (error) {
      console.error('Failed to initialize app:', error);
      message.error('应用初始化失败');
    }
  };

  const handleStartProxy = async (config: any) => {
    try {
      if (!window.electronAPI) return;
      const result = await window.electronAPI.proxy.start(config);
      if (result.success) {
        message.success('代理服务启动成功');
        proxyStore.setRunning(true);
        proxyStore.setConfig(config);
      } else {
        message.error(result.message);
      }
    } catch (error) {
      console.error('Failed to start proxy:', error);
      message.error('启动代理服务失败');
    }
  };

  const handleStopProxy = async () => {
    try {
      if (!window.electronAPI) return;
      const result = await window.electronAPI.proxy.stop();
      if (result.success) {
        message.success('代理服务已停止');
        proxyStore.setRunning(false);
      } else {
        message.error(result.message);
      }
    } catch (error) {
      console.error('Failed to stop proxy:', error);
      message.error('停止代理服务失败');
    }
  };

  const handleClearData = async () => {
    try {
      if (!window.electronAPI) return;
      const result = await window.electronAPI.capture.clearCapturedData();
      if (result.success) {
        message.success('数据已清空');
        captureStore.clearData();
      } else {
        message.error(result.message);
      }
    } catch (error) {
      console.error('Failed to clear data:', error);
      message.error('清空数据失败');
    }
  };

  const handleExportData = async (format: string) => {
    try {
      if (!window.electronAPI) return;
      const result = await window.electronAPI.capture.exportData(format);
      if (result.success) {
        message.success('数据导出成功');
      } else {
        message.error(result.message);
      }
    } catch (error) {
      console.error('Failed to export data:', error);
      message.error('导出数据失败');
    }
  };

  // 根据 URL 初始化/同步当前选中面板（仅取一级路径）
  useEffect(() => {
    const path = location.pathname.replace(/^\/+/, '') || 'capture';
    const root = path.split('/')[0] || 'capture';
    if (root !== activePanel) {
      setActivePanel(root);
    }
  }, [location.pathname]);

  return (
    <Provider>
      <Routes>
        <Route
          path="/*"
          element={
            <Layout className="netsniffer-app">
              {/* macOS 标题栏 */}
              {process.platform === 'darwin' && (
                <div className="netsniffer-titlebar">
                  <div className="title">NetSniffer</div>
                </div>
              )}

              {/* 顶部工具栏：操作按钮居右 */}
              <Header className="netsniffer-topbar">
                NetSniffer
                {/* <Toolbar
                  onStartProxy={handleStartProxy}
                  onStopProxy={handleStopProxy}
                  onClearData={handleClearData}
                  onExportData={handleExportData}
                /> */}
              </Header>

              {/* 主内容区（与功能面板同一水平线） */}
              <Content className="netsniffer-main">
                <div className="netsniffer-body">
                  {/* 侧边栏 */}
                  <Sidebar activePanel={activePanel} onPanelChange={setActivePanel} />

                  {/* 内容区 */}
                  <div className="netsniffer-content">
                    <ContentArea />
                  </div>
                </div>
              </Content>

              {/* 状态栏 */}
              <Footer style={{ padding: 0, height: 'auto' }}>
                <StatusBar />
              </Footer>
            </Layout>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Provider>
  );
};
