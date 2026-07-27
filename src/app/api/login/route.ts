/* eslint-disable no-console */
import { NextRequest, NextResponse } from 'next/server';

import { setSessionCookies } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';

export const runtime = 'edge';

const STORAGE_TYPE = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const password = body?.password;
    if (typeof password !== 'string' || !password) {
      return NextResponse.json({ error: '密码不能为空' }, { status: 400 });
    }

    if (STORAGE_TYPE === 'localstorage') {
      if (!process.env.PASSWORD || password !== process.env.PASSWORD) {
        return NextResponse.json(
          { ok: false, error: '密码错误' },
          { status: 401 }
        );
      }
      const response = NextResponse.json({ ok: true });
      await setSessionCookies(response, req, {
        username: 'default',
        role: 'user',
        storageType: 'localstorage',
      });
      return response;
    }

    const username = body?.username;
    if (typeof username !== 'string' || !username) {
      return NextResponse.json({ error: '用户名不能为空' }, { status: 400 });
    }

    let role: 'owner' | 'admin' | 'user' = 'user';
    if (username === process.env.USERNAME) {
      if (password !== process.env.PASSWORD) {
        return NextResponse.json(
          { error: '用户名或密码错误' },
          { status: 401 }
        );
      }
      role = 'owner';
    } else {
      const config = await getConfig();
      const user = config.UserConfig.Users.find(
        (item) => item.username === username
      );
      if (!user || user.banned || !(await db.verifyUser(username, password))) {
        return NextResponse.json(
          { error: '用户名或密码错误' },
          { status: 401 }
        );
      }
      role = user.role || 'user';
    }

    const response = NextResponse.json({ ok: true });
    await setSessionCookies(response, req, {
      username,
      role,
      storageType: 'account',
    });
    return response;
  } catch (error) {
    console.error('登录接口异常', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
