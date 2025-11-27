export type ApiEnv = 'dev' | 'test' | 'release' | 'prod';

// 统一管理各环境基础地址
export const API_BASES: Record<ApiEnv, string> = {
  // dev: 'http://127.0.0.1:40633',
  dev: 'https://test-fenxiao.myscrm.cn/bff-agency-cloud-guard',
  test: 'https://test-fenxiao.myscrm.cn/bff-agency-cloud-guard',
  release: 'https://beta-fenxiao.myscrm.cn/bff-agency-cloud-guard',
  prod: 'https://fenxiao.myscrm.cn/bff-agency-cloud-guard',
};

// 解析初始 BaseURL：优先显式变量，其次根据环境变量判断 dev/test/prod
export function resolveBaseURL(): string {
  const explicit =
    (typeof process !== 'undefined' && process.env && process.env.AIRE_API_BASE) ||
    (typeof window !== 'undefined' && (window as { AIRE_API_BASE?: string }).AIRE_API_BASE);
  if (explicit) return String(explicit).replace(/\/$/, '');

  // 优先使用 API_ENV，如果没有则根据 NODE_ENV 映射
  const apiEnv =
    (typeof process !== 'undefined' && process.env && (process.env.API_ENV as ApiEnv)) ||
    (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production'
      ? 'prod'
      : null);

  // 直接返回对应环境的 API 地址
  if (apiEnv === 'dev') return API_BASES.dev;
  if (apiEnv === 'test') return API_BASES.test;
  if (apiEnv === 'release') return API_BASES.release;
  if (apiEnv === 'prod') return API_BASES.prod;

  // 默认使用测试环境
  return API_BASES.test;
}

// 获取当前 API 环境标识
export function getCurrentApiEnv(): ApiEnv {
  const apiEnv =
    (typeof process !== 'undefined' && process.env && (process.env.API_ENV as ApiEnv)) ||
    (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production'
      ? 'prod'
      : null);
  return apiEnv || 'prod';
}
