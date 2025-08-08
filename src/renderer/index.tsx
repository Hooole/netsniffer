import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { App } from './components/app';
import './styles/global.less';

// 配置antd
const { defaultAlgorithm, darkAlgorithm } = theme;

const AppRoot: React.FC = () => {
  const [isDark, setIsDark] = React.useState(false);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: isDark ? darkAlgorithm : defaultAlgorithm,
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 6,
        },
      }}
    >
      <App />
    </ConfigProvider>
  );
};

// 渲染应用
const container = document.getElementById('root');
const root = createRoot(container!);

root.render(<AppRoot />);