import React from 'react';
import { CapturePanel } from '../../extensions/capture';
import { RulesPanel } from '../../extensions/rules';
import { CertificatePanel } from '../../extensions/certificate';
import { StatisticsPanel } from '../../extensions/statistics';
import { SettingsPanel } from '../../extensions/settings';

interface ContentAreaProps {
  activePanel: string;
}

export const ContentArea: React.FC<ContentAreaProps> = ({ activePanel }) => {
  const renderPanel = () => {
    switch (activePanel) {
      case 'capture':
        return <CapturePanel />;
      case 'rules':
        return <RulesPanel />;
      case 'certificate':
        return <CertificatePanel />;
      case 'statistics':
        return <StatisticsPanel />;
      case 'settings':
        return <SettingsPanel />;
      default:
        return <CapturePanel />;
    }
  };

  return (
    <div className="netsniffer-content">
      {renderPanel()}
    </div>
  );
};