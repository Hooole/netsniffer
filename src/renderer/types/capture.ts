// 抓包数据推送到服务端的精简结构
export type PushCaptureItem = {
  method: string;
  url: string;
  host: string;
  statusCode?: number;
  headers?: Record<string, string>;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  responseBody?: string;
};
