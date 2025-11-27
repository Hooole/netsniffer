import { http } from './http';
import type {
  PlatformListResponse,
  ResidentBindInfoRequest,
  ResidentBindInfoResponse,
  SubmitBindRequest,
  SubmitBindResponse,
  TestConnectRequest,
  TestConnectResponse,
} from './types/platform';

export type { PlatformItem, AuthInfoItem } from './types/platform';

export const getPlatformList = () => http.post<PlatformListResponse>('/rpa/platform/list');

// 获取配置信息
export const getResidentBindInfo = (body: ResidentBindInfoRequest) =>
  http.post<ResidentBindInfoResponse>('/rpa/platform/resident-bind-info', body);

// 保存配置信息
export const submitBind = (body: SubmitBindRequest) =>
  http.post<SubmitBindResponse>('/rpa/submit-bind', body);

// 测试连接
export const testConnect = (body: TestConnectRequest) =>
  http.post<TestConnectResponse>('/rpa/test-connect', body);
