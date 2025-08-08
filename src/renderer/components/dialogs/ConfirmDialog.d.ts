import React from 'react';
interface ConfirmDialogProps {
    visible: boolean;
    title: string;
    content: string;
    onCancel: () => void;
    onConfirm: () => void;
    confirmLoading?: boolean;
    type?: 'warning' | 'danger' | 'info';
}
export declare const ConfirmDialog: React.FC<ConfirmDialogProps>;
export {};
//# sourceMappingURL=ConfirmDialog.d.ts.map