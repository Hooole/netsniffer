import React from 'react';
import { Result, Button } from 'antd';
import { BarChartOutlined } from '@ant-design/icons';

export const StatisticsPanel: React.FC = () => {
  return (
    <Result
      icon={<BarChartOutlined />}
      title="统计分析"
      subTitle="查看网络请求的统计数据和分析报告"
      extra={
        <Button type="primary">
          生成报告
        </Button>
      }
    />
  );
};