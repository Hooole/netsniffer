export interface PlatformItem {
  id: string;
  platform_code: string;
  platform_name: string;
  platform_app_name: string;
  platform_status?: string; // '1' 未开发，'2' 开发中，'3' 草稿，'4' 已完成
}

export interface PlatformListResponse {
  code: string | number;
  msg: string;
  data: {
    list: PlatformItem[];
    total: string;
    page: number;
  };
}

// 获取配置信息相关类型
export interface AuthInfoItem {
  rules: string[];
  key: string;
  label: string;
  value: string;
  require_icon: string;
  placeholder: string;
}

export interface ResidentBindInfoRequest {
  org_code: string;
  resident_mobile: string;
  platform_code: string;
  auth_type: number;
}

export interface ResidentBindInfoResponse {
  code: number;
  msg: string;
  data: {
    auth_info: AuthInfoItem[];
    auth_type: number;
    auth_status: number;
  };
}

export interface SubmitBindRequest {
  org_code: string;
  platform_code: string;
  resident_mobile: string;
  resident_id: string;
  resident_name: string;
  auth_type: number;
  auth_info: string;
}

export interface SubmitBindResponse {
  code: number;
  msg: string;
  data: {
    code: number;
    msg: string;
  };
}

export interface TestConnectRequest {
  org_code: string;
  platform_code: string;
  resident_mobile: string;
  resident_id: string;
  auth_type: number;
}

export interface TestConnectResponse {
  code: number;
  msg: string;
  data: {
    code: number;
    msg: string;
  };
}
