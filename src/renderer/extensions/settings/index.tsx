import React from 'react';
import { Result, Button } from 'antd';
import { SettingOutlined } from '@ant-design/icons';

export const SettingsPanel: React.FC = () => {
  return (
    <Result
      icon={<SettingOutlined />}
      title="应用设置"
      subTitle="配置应用的各项参数和选项"
      extra={
        <Button type="primary">
          打开设置
        </Button>
      }
    />
  );
};