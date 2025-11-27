import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { CapturePanel } from '../../extensions/capture';
import { CertificatePanel } from '../../extensions/certificate';
import { SettingsPanel } from '../../extensions/settings';

export const ContentArea: React.FC = () => {
  return (
    <div className="netsniffer-content">
      <Routes>
        <Route index element={<Navigate to="/capture" replace />} />
        <Route path="/capture" element={<CapturePanel />} />
        <Route path="/certificate" element={<CertificatePanel />} />
        <Route path="/settings" element={<SettingsPanel />} />
        <Route path="*" element={<Navigate to="/capture" replace />} />
      </Routes>
    </div>
  );
};
