import React from 'react';
interface CapturedRequest {
    id: string;
    timestamp: string;
    method: string;
    url: string;
    host: string;
    protocol: string;
    statusCode?: number;
    requestHeaders?: Record<string, string>;
    responseHeaders?: Record<string, string>;
    requestBody?: string;
    responseBody?: string;
    duration?: number;
}
interface RequestDetailDialogProps {
    visible: boolean;
    request: CapturedRequest | null;
    onCancel: () => void;
}
export declare const RequestDetailDialog: React.FC<RequestDetailDialogProps>;
export {};
//# sourceMappingURL=RequestDetailDialog.d.ts.map