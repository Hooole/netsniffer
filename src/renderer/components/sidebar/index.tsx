import React from 'react';
import { Menu } from 'antd';
import {
  BugOutlined,
  SettingOutlined,
  FileTextOutlined,
  SecurityScanOutlined,
  BarChartOutlined,
} from '@ant-design/icons';

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
    key: 'rules',
    icon: <FileTextOutlined />,
    label: '规则管理',
  },
  {
    key: 'certificate',
    icon: <SecurityScanOutlined />,
    label: '证书管理',
  },
  {
    key: 'statistics',
    icon: <BarChartOutlined />,
    label: '统计分析',
  },
  {
    key: 'settings',
    icon: <SettingOutlined />,
    label: '设置',
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ activePanel, onPanelChange }) => {
  return (
    <div className="netsniffer-sidebar">
      <div className="sidebar-header">
        功能面板
      </div>
      
      <div className="sidebar-content">
        <Menu
          mode="inline"
          selectedKeys={[activePanel]}
          items={menuItems}
          onClick={({ key }) => onPanelChange(key)}
          style={{ border: 'none' }}
        />
      </div>
    </div>
  );
};