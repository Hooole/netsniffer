import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { App } from './components/app';
import { HashRouter } from 'react-router-dom';
import './styles/global.less';
import { appTheme } from './styles/theme';

// 配置antd
// const { defaultAlgorithm, darkAlgorithm } = theme;

const AppRoot: React.FC = () => {
  // const [isDark, setIsDark] = React.useState(false);

  return (
    <ConfigProvider locale={zhCN} theme={appTheme}>
      <HashRouter>
        <App />
      </HashRouter>
    </ConfigProvider>
  );
};

// 渲染应用
const container = document.getElementById('root');
const root = createRoot(container!);

root.render(<AppRoot />);
