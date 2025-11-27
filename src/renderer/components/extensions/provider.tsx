import React from 'react';

interface ProviderProps {
  children: React.ReactNode;
}

// 扩展系统的提供者组件
export const Provider: React.FC<ProviderProps> = ({ children }) => {
  return <>{children}</>;
};