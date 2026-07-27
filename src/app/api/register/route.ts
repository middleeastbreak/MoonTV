/* eslint-disable no-console */
import { NextRequest, NextResponse } from 'next/server';

import { setSessionCookies } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    if (
      (process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage') ===
      'localstorage'
    ) {
      return NextResponse.json(
        { error: '当前模式不支持注册' },
        { status: 400 }
      );
    }
    const config = await getConfig();
    if (!config.UserConfig.AllowRegister) {
      return NextResponse.json({ error: '当前未开放注册' }, { status: 400 });
    }
    const { username, password } = await req.json();
    if (typeof username !== 'string' || !username.trim()) {
      return NextResponse.json({ error: '用户名不能为空' }, { status: 400 });
    }
    if (typeof password !== 'string' || !password) {
      return NextResponse.json({ error: '密码不能为空' }, { status: 400 });
    }
    if (
      username === process.env.USERNAME ||
      (await db.checkUserExist(username))
    ) {
      return NextResponse.json({ error: '用户已存在' }, { status: 400 });
    }

    await db.registerUser(username, password);
    config.UserConfig.Users.push({ username, role: 'user' });
    await db.saveAdminConfig(config);

    const response = NextResponse.json({ ok: true });
    await setSessionCookies(response, req, {
      username,
      role: 'user',
      storageType: 'account',
    });
    return response;
  } catch (error) {
    console.error('注册接口异常', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
