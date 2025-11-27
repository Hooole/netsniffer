import React, { useState, useEffect } from 'react';
import { Space, Tag } from 'antd';
import { useProxyStore } from '../../store/proxy-store';
import { useCaptureStore } from '../../store/capture-store';

export const StatusBar: React.FC = () => {
  const { isRunning, config } = useProxyStore();
  const { capturedData } = useCaptureStore();
  const [uptime, setUptime] = useState('00:00:00');
  const [startTime, setStartTime] = useState<number | null>(null);

  useEffect(() => {
    if (isRunning && !startTime) {
      setStartTime(Date.now());
    } else if (!isRunning) {
      setStartTime(null);
      setUptime('00:00:00');
    }
  }, [isRunning]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (isRunning && startTime) {
      timer = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        
        setUptime(
          `${hours.toString().padStart(2, '0')}:${minutes
            .toString()
            .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRunning, startTime]);

  return (
    <div
      style={{
        height: 32,
        borderTop: '1px solid #d9d9d9',
        background: '#fafafa',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        fontSize: 12,
        color: '#666',
      }}
    >
      <Space size={16}>
        <span>
          状态:{' '}
          <Tag color={isRunning ? 'green' : 'default'}>
            {isRunning ? '运行中' : '已停止'}
          </Tag>
        </span>
        
        {isRunning && config && (
          <span>
            代理: {config.host}:{config.port}
          </span>
        )}
        
        <span>
          抓包数量: {capturedData.length}
        </span>
        
        <span>
          运行时间: {uptime}
        </span>
        
        <div style={{ marginLeft: 'auto' }}>
          <span>AiResident v2.0.0</span>
        </div>
      </Space>
    </div>
  );
};