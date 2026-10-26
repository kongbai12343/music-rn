import { apiConfig } from '@/config/apiConfig';

export type ApiRecord = Record<string, unknown>;

/** 统一接口异常；code 为 HTTP 状态或业务码，0 表示配置、网络或响应结构等异常。 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface SessionAccessors {
  getCookie: () => string | null;
  onSessionExpired: (cookie: string) => void;
}

let sessionAccessors: SessionAccessors = { getCookie: () => null, onSessionExpired: () => {} };
let lastRequestTimestamp = 0;

// 由账号模块注入会话访问方法，避免请求层反向依赖账号状态而形成循环引用。
export function configureSessionAccessors(accessors: SessionAccessors) {
  sessionAccessors = accessors;
}

/** 只接受非 null 且非数组的对象，不校验内部字段；其他结构返回空对象。 */
export function asRecord(value: unknown): ApiRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as ApiRecord)
    : {};
}

/** 只保留数组；字段缺失或类型不符时返回空数组，不尝试强制转换。 */
export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** 只保留字符串；不会把数字、对象等错误类型转换成可展示的文本。 */
export function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** 只接受有限 number；数值字符串、NaN 和无穷值均使用 fallback。 */
export function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function describeApiError(code: number): string {
  if (code === 301 || code === 401) return '登录已失效，请重新登录';
  if (code === 400) return '请求参数无效，或服务要求额外验证，请检查 API 版本';
  if (code === 403) return '服务拒绝访问，请检查账号权限与接口配置';
  if (code === 460) return '上游触发风控，请稍后重试并检查自部署服务的网络';
  if (code === 429 || code === 503) return '请求过于频繁，请稍后重试';
  if (code === 502) return '上游服务未接受请求，请检查验证码或稍后重试';
  return `接口请求失败（${code}），请稍后重试`;
}

interface RequestOptions {
  signal?: AbortSignal;
  /** 不传时使用当前会话；传 null 时明确不携带会话，用于登录和游客接口。 */
  cookie?: string | null;
  /**
   * 要求存在凭据，并在登录失效时通知账号模块；此处不区分游客与用户 Cookie。
   * 需要用户身份的页面仍须检查 profile，不能只依赖此标记判断已登录。
   */
  authenticated?: boolean;
  /** 部分接口用业务码表示正常的等待状态，例如二维码登录的 801、802。 */
  acceptedCodes?: number[];
}

/**
 * 统一处理接口请求、凭据传递、超时与取消；调用方主动取消时抛出 AbortError。
 * path 是以 / 开头的接口路径，而非完整 URL；基础地址统一由 apiConfig 提供。
 */
export async function requestApi(
  path: string,
  parameters: ApiRecord = {},
  options: RequestOptions = {},
): Promise<ApiRecord> {
  if (!apiConfig.isApiConfigured)
    throw new ApiError('尚未配置 API，请在 .env 中填写 EXPO_PUBLIC_API_BASE_URL 并重启应用', 0);
  const cookie = options.cookie === undefined ? sessionAccessors.getCookie() : options.cookie;
  if (options.authenticated && !cookie) throw new ApiError('请先登录后再使用此功能', 301);
  const abortController = new AbortController();
  const cancelRequest = () => abortController.abort();
  if (options.signal?.aborted) abortController.abort();
  options.signal?.addEventListener('abort', cancelRequest, { once: true });
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    abortController.abort();
  }, 12000);
  // 上游按 URL 缓存响应，不区分请求体与 Cookie；递增时间戳避免不同请求共用缓存。
  lastRequestTimestamp = Math.max(Date.now(), lastRequestTimestamp + 1);
  try {
    const response = await fetch(
      `${apiConfig.apiBaseUrl}${path}?timestamp=${lastRequestTimestamp}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 不使用浏览器自动携带的 Cookie，也不把凭据放进可能被记录或分享的 URL。
        credentials: 'omit',
        body: JSON.stringify({ ...parameters, ...(cookie ? { cookie } : {}) }),
        signal: abortController.signal,
      },
    );
    const payload = asRecord(await response.json());
    // HTTP 错误优先于响应体业务码，避免 HTTP 401 配合 code: 200 被误判为成功。
    const code = response.ok ? asNumber(payload.code, response.status) : response.status;
    const acceptedCodes = options.acceptedCodes ?? [200];
    if (!response.ok || !acceptedCodes.includes(code)) {
      if (options.authenticated && cookie && [301, 401].includes(code))
        sessionAccessors.onSessionExpired(cookie);
      throw new ApiError(describeApiError(code), code);
    }
    return payload;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (timedOut) throw new ApiError('接口请求超时，请检查服务是否运行、网络与防火墙', 0);
    if (abortController.signal.aborted) {
      const cancelledError = new Error('请求已取消');
      cancelledError.name = 'AbortError';
      throw cancelledError;
    }
    throw new ApiError('无法连接 API 或响应格式无效，请检查服务地址与网络', 0);
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', cancelRequest);
  }
}
