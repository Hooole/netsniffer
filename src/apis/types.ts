export type ApiBasicResponse = {
  code: string | number;
  msg: string;
  [key: string]: any;
};

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface RequestOptions extends Omit<RequestInit, 'body' | 'method'> {
  method?: HttpMethod;
  params?: Record<string, any>;
  body?: Record<string, any> | FormData | string | undefined | null;
  timeoutMs?: number;
  headers?: Record<string, string>;
  // 是否跳过业务层 code 校验，直接返回响应数据
  skipBusinessCheck?: boolean;
  // 是否静默，不弹出全局错误提示
  silent?: boolean;
  // 当 path 以 / 开头时，是否使用 window.location.origin 作为基准（不拼接 baseURL）
  useOrigin?: boolean;
}

export class ApiError<T = any> extends Error {
  public code?: string | number;
  public status?: number;
  public payload?: T;

  constructor(message: string, opts?: { code?: string | number; status?: number; payload?: T }) {
    super(message);
    this.name = 'ApiError';
    this.code = opts?.code;
    this.status = opts?.status;
    this.payload = opts?.payload;
  }
}
