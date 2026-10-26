// Expo 在打包时注入公共环境变量；此处只放服务地址，不能包含 Cookie、密码或密钥。
const configuredApiUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? '';

/** 拒绝非 HTTP(S) 或自带账号密码的地址，移除尾部斜杠；空值与无效地址统一返回空字符串。 */
function normalizeApiUrl(value: string): string {
  if (!value) return '';
  try {
    const parsedUrl = new URL(value);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) return '';
    if (parsedUrl.username || parsedUrl.password) return '';
    return value.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

/** 配置状态只表示地址通过本地校验，不代表服务已启动或所有接口可用。 */
export const apiConfig = {
  apiBaseUrl: normalizeApiUrl(configuredApiUrl),
  isApiConfigured: Boolean(normalizeApiUrl(configuredApiUrl)),
  hasInvalidApiUrl: Boolean(configuredApiUrl && !normalizeApiUrl(configuredApiUrl)),
};
