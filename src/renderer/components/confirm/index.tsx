import React from 'react';
import { Modal } from 'antd';
import type { ModalFuncProps } from 'antd';
import LogoIcon from '@assets/icon.png';
import styles from './index.module.less';

export interface ConfirmOptions {
  title: React.ReactNode;
  /** 支持富文本内容 */
  content?: React.ReactNode;
  /** 右下角确认按钮文案 */
  okText?: string;
  /** 右下角取消按钮文案 */
  cancelText?: string;
  /** danger 确认按钮样式 */
  okType?: 'primary' | 'danger';
  /** 自定义图标（左上角） */
  icon?: React.ReactNode;
  /** 对话框宽度 */
  width?: number;
  /** 蒙层点击是否可关闭 */
  maskClosable?: boolean;
  /** 额外的 antd 配置透传 */
  modalProps?: Partial<ModalFuncProps>;
}

/**
 * 全局确认弹框（Promise 化）
 * 使用：
 * const ok = await showConfirm({ title: '确认操作', content: '是否继续？' });
 */
export function showConfirm(options: ConfirmOptions): Promise<boolean> {
  const {
    title,
    content,
    okText = '确认',
    cancelText = '取消',
    okType = 'primary',
    icon,
    width = 520,
    maskClosable = false,
    modalProps = {},
  } = options;

  return new Promise((resolve) => {
    const instance = Modal.confirm({
      icon: null,
      width,
      centered: true,
      className: styles.confirmModal,
      okText,
      cancelText,
      okButtonProps: { danger: okType === 'danger' },
      maskClosable,
      title: (
        <div className={styles.titleRow}>
          <span className={styles.titleIcon}>
            {icon || <img src={LogoIcon} alt="logo" className={styles.titleIconImg} />}
          </span>
          <span className={styles.titleText}>{title}</span>
        </div>
      ),
      content: <div className={styles.content}>{content}</div>,
      onOk: () => {
        resolve(true);
      },
      onCancel: () => {
        resolve(false);
      },
      ...modalProps,
    });

    // 保险：组件卸载时销毁
    // antd 会在关闭后自动销毁，这里不做额外处理
    return instance;
  });
}

export default showConfirm;
