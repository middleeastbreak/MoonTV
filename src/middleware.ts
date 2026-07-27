import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie, verifyAuthInfo } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (shouldSkipAuth(pathname)) return NextResponse.next();

  if (!process.env.PASSWORD) {
    return NextResponse.redirect(new URL('/warning', request.url));
  }

  const authInfo = getAuthInfoFromCookie(request);
  if (!(await verifyAuthInfo(authInfo))) {
    return handleAuthFailure(request, pathname);
  }

  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (
    (storageType === 'localstorage' &&
      authInfo?.storageType !== 'localstorage') ||
    (storageType !== 'localstorage' && authInfo?.storageType !== 'account')
  ) {
    return handleAuthFailure(request, pathname);
  }

  return NextResponse.next();
}

function handleAuthFailure(
  request: NextRequest,
  pathname: string
): NextResponse {
  if (pathname.startsWith('/api')) {
    return NextResponse.json(
      { error: '登录已过期，请重新登录' },
      { status: 401 }
    );
  }
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

function shouldSkipAuth(pathname: string): boolean {
  return [
    '/_next',
    '/favicon.ico',
    '/robots.txt',
    '/manifest.json',
    '/icons/',
    '/logo.png',
    '/screenshot.png',
  ].some((path) => pathname.startsWith(path));
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|login|warning|api/login|api/register|api/logout|api/cron|api/server-config|api/tvbox/config|api/tvbox/categories|api/douban/recommends).*)',
  ],
};
