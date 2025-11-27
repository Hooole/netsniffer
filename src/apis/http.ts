import { ApiBasicResponse, ApiError, RequestOptions } from './types';
import { API_BASES, resolveBaseURL } from './env';
import { message } from 'antd';

const TEST_BASE_URL = API_BASES.test;
const DEV_BASE_URL = API_BASES.dev;

// 初始 baseURL：优先 AIRE_API_BASE，其次按环境选择
let baseURL = resolveBaseURL();
export const setBaseURL = (url: string) => {
  baseURL = url.replace(/\/$/, '');
};
export const getBaseURL = () => baseURL;

export const setApiEnv = (env: 'dev' | 'test') => {
  baseURL = (env === 'dev' ? DEV_BASE_URL : TEST_BASE_URL).replace(/\/$/, '');
};

function buildURL(path: string, params?: Record<string, unknown>): string {
  const url = new URL(`${baseURL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`);
  if (params) {
    Object.keys(params).forEach((key) => {
      const value = (params as Record<string, unknown>)[key];
      if (value === undefined || value === null) return;
      if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(key, String(v)));
      else url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
}

async function parseJSON<T>(resp: Response): Promise<T> {
  const text = await resp.text();
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    // 非 JSON 响应
    throw new ApiError('响应解析失败', { status: resp.status, payload: text });
  }
}

export async function request<T extends ApiBasicResponse = ApiBasicResponse>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    method = 'GET',
    params,
    body,
    timeoutMs = 15000,
    headers,
    skipBusinessCheck,
    silent,
    ...rest
  } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const isJSONBody = body && !(body instanceof FormData) && typeof body !== 'string';
  const reqInit: RequestInit = {
    method,
    signal: controller.signal,
    headers: {
      Accept: 'application/json',
      ...(isJSONBody ? { 'Content-Type': 'application/json' } : {}),
      ...(headers || {}),
    },
    ...rest,
  };
  if (method !== 'GET') {
    if (isJSONBody) reqInit.body = JSON.stringify(body);
    else if (body != null) reqInit.body = body as BodyInit;
  }

  const url = buildURL(path, params);

  try {
    const fail = (
      msg: string,
      opts?: { code?: string | number; status?: number; payload?: unknown }
    ) => {
      const err = new ApiError(msg, opts);
      if (!silent) message.error(err.message);
      throw err;
    };

    const resp = await fetch(url, reqInit);

    // 网络层错误
    if (!resp.ok) {
      let payload: unknown;
      try {
        payload = (await parseJSON(resp)) as unknown;
      } catch {}

      fail((payload as { msg?: string })?.msg || `请求失败(${resp.status})`, {
        status: resp.status,
        payload,
      });
    }

    const data = await parseJSON<T>(resp);

    // 业务层 code 判断：约定 code 为 '0' 或 0 为成功
    if (!skipBusinessCheck) {
      const d = data as unknown as { code?: string | number; msg?: string };
      const success = d?.code === '0' || d?.code === 0;

      if (!success)
        fail(d?.msg || '业务错误', { code: d?.code, status: resp.status, payload: data });
    }

    return data;
  } catch (caught) {
    // 优先判断我们抛出的业务/HTTP错误，直接上抛，避免重复提示
    if (caught instanceof ApiError) {
      throw caught;
    }
    const e = caught as unknown as { name?: string; message?: string };
    if (e?.name === 'AbortError') {
      const err = new ApiError('请求超时', { code: 'TIMEOUT' });
      if (!silent) message.error(err.message);
      throw err;
    }
    // 其余错误统一提示
    const err = new ApiError(e?.message || '请求失败');
    if (!silent) message.error(err.message);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const http = {
  get: <T extends ApiBasicResponse = ApiBasicResponse>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...(options || {}), method: 'GET' }),
  post: <T extends ApiBasicResponse = ApiBasicResponse>(
    path: string,
    body?: RequestOptions['body'],
    options?: RequestOptions
  ) => request<T>(path, { ...(options || {}), method: 'POST', body }),
  put: <T extends ApiBasicResponse = ApiBasicResponse>(
    path: string,
    body?: RequestOptions['body'],
    options?: RequestOptions
  ) => request<T>(path, { ...(options || {}), method: 'PUT', body }),
  patch: <T extends ApiBasicResponse = ApiBasicResponse>(
    path: string,
    body?: RequestOptions['body'],
    options?: RequestOptions
  ) => request<T>(path, { ...(options || {}), method: 'PATCH', body }),
  delete: <T extends ApiBasicResponse = ApiBasicResponse>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...(options || {}), method: 'DELETE' }),
};


