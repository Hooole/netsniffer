import React, { useEffect } from 'react';
import { Menu, type MenuProps } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BugOutlined,
  SettingOutlined,
  SecurityScanOutlined,
} from '@ant-design/icons';
import logo from '@assets/images/logo.gif';
import styles from './index.module.less';

interface SidebarProps {
  activePanel: string;
  onPanelChange: (panel: string) => void;
}

const menuItems = [
  {
    key: 'capture',
    icon: <BugOutlined />,
    label: '抓包分析',
  },
  {
    key: 'certificate',
    icon: <SecurityScanOutlined />,
    label: '证书管理',
  },
  {
    key: 'settings',
    icon: <SettingOutlined />,
    label: '设置',
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ activePanel, onPanelChange }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleClick: MenuProps['onClick'] = ({ key }) => {
    onPanelChange(key);
    navigate(`/${key}`);
  };

  useEffect(() => {
    // 当地址栏变化时，同步选中项（支持后退/前进）
    const path = location.pathname.replace(/^\//, '') || 'capture';
    const root = path.split('/')[0] || 'capture';
    if (root !== activePanel) {
      onPanelChange(root);
    }
  }, [location.pathname]);

  return (
    <div className="netsniffer-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <img src={logo} alt="logo" className="sidebar-logo-img" />
        </div>
        <div className="sidebar-title">NetSniffer</div>
      </div>

      <div className="sidebar-content">
        <Menu
          mode="inline"
          selectedKeys={[activePanel]}
          items={menuItems}
          onClick={handleClick}
          className={styles.menu}
        />
      </div>

      <div className={styles.footer}>
        {/* Footer content removed or replaced with generic settings if needed */}
      </div>
    </div>
  );
};
