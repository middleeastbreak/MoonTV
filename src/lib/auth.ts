import { NextRequest, NextResponse } from 'next/server';

export type AuthRole = 'owner' | 'admin' | 'user';

export interface AuthInfo {
  username?: string;
  role: AuthRole;
  storageType: 'localstorage' | 'account';
  timestamp: number;
  expiresAt: number;
  signature: string;
}

type PublicUserInfo = Pick<AuthInfo, 'username' | 'role' | 'storageType'>;

const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function sessionSecret(): string {
  return process.env.SESSION_SECRET || process.env.PASSWORD || '';
}

function serializePayload(info: Omit<AuthInfo, 'signature'>): string {
  return JSON.stringify({
    username: info.username,
    role: info.role,
    storageType: info.storageType,
    timestamp: info.timestamp,
    expiresAt: info.expiresAt,
  });
}

async function hmac(payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(sessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );
  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

function decodeCookie<T>(value?: string): T | null {
  if (!value) return null;
  let decoded = value;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return JSON.parse(decoded) as T;
    } catch {
      try {
        decoded = decodeURIComponent(decoded);
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function getAuthInfoFromCookie(request: NextRequest): AuthInfo | null {
  return decodeCookie<AuthInfo>(request.cookies.get('auth')?.value);
}

export async function verifyAuthInfo(info: AuthInfo | null): Promise<boolean> {
  if (
    !info ||
    !info.signature ||
    !info.timestamp ||
    !info.expiresAt ||
    info.expiresAt <= Date.now() ||
    info.timestamp > Date.now() + 60_000 ||
    !sessionSecret()
  ) {
    return false;
  }

  const { signature, ...payload } = info;
  const expected = await hmac(serializePayload(payload));
  if (signature.length !== expected.length) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(sessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const bytes = new Uint8Array(
    signature.match(/.{2}/g)?.map((pair) => Number.parseInt(pair, 16)) || []
  );
  return crypto.subtle.verify(
    'HMAC',
    key,
    bytes,
    encoder.encode(serializePayload(payload))
  );
}

export async function setSessionCookies(
  response: NextResponse,
  request: NextRequest,
  user: PublicUserInfo
): Promise<void> {
  const timestamp = Date.now();
  const payload: Omit<AuthInfo, 'signature'> = {
    ...user,
    timestamp,
    expiresAt: timestamp + SESSION_MAX_AGE_SECONDS * 1000,
  };
  const auth: AuthInfo = {
    ...payload,
    signature: await hmac(serializePayload(payload)),
  };
  const secure =
    request.nextUrl.protocol === 'https:' ||
    request.headers.get('x-forwarded-proto')?.split(',')[0].trim() === 'https';

  response.cookies.set('auth', encodeURIComponent(JSON.stringify(auth)), {
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
    sameSite: 'lax',
    httpOnly: true,
    secure,
  });
  // 该 Cookie 仅供界面展示用户名和角色，服务端绝不信任其权限信息。
  response.cookies.set('user-info', encodeURIComponent(JSON.stringify(user)), {
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
    sameSite: 'lax',
    httpOnly: false,
    secure,
  });
}

export function clearSessionCookies(response: NextResponse): void {
  for (const name of ['auth', 'user-info']) {
    response.cookies.set(name, '', { path: '/', expires: new Date(0) });
  }
}

// 客户端只读取不含签名和凭据的展示 Cookie。
export function getAuthInfoFromBrowserCookie(): PublicUserInfo | null {
  if (typeof document === 'undefined') return null;
  const value = document.cookie
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith('user-info='))
    ?.slice('user-info='.length);
  return decodeCookie<PublicUserInfo>(value);
}
