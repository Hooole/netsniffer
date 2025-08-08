import React from 'react';
import { Result, Button } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';

export const RulesPanel: React.FC = () => {
  return (
    <Result
      icon={<FileTextOutlined />}
      title="规则管理"
      subTitle="配置代理规则和拦截策略"
      extra={
        <Button type="primary">
          创建规则
        </Button>
      }
    />
  );
};