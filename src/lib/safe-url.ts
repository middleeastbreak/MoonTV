const PRIVATE_IPV4 = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^224\./,
  /^2(2[4-9]|3\d|4\d|5[0-5])\./,
];

export function validateExternalUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('URL 格式无效');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('仅支持 HTTP 或 HTTPS 地址');
  }
  if (url.username || url.password) throw new Error('URL 不得包含登录凭据');

  if (process.env.ALLOW_PRIVATE_SOURCE !== 'true') {
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    const isPrivate =
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname === '::1' ||
      hostname.startsWith('fc') ||
      hostname.startsWith('fd') ||
      hostname.startsWith('fe8') ||
      PRIVATE_IPV4.some((pattern) => pattern.test(hostname));
    if (isPrivate) {
      throw new Error(
        '默认禁止访问内网地址；可信部署可设置 ALLOW_PRIVATE_SOURCE=true'
      );
    }
  }
  return url;
}

export async function fetchExternal(
  value: string,
  init: RequestInit = {},
  maxRedirects = 3
): Promise<Response> {
  let current = validateExternalUrl(value);
  for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(current, {
        ...init,
        redirect: 'manual',
        signal: controller.signal,
      });
      if (response.status < 300 || response.status >= 400) return response;
      const location = response.headers.get('location');
      if (!location) return response;
      current = validateExternalUrl(new URL(location, current).toString());
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error('重定向次数过多');
}

export async function readLimitedText(response: Response, maxBytes: number) {
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > maxBytes) throw new Error('远程内容超过大小限制');
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new Error('远程内容超过大小限制');
  }
  return text;
}
