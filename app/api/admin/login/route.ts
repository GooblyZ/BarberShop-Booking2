import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, getExpectedSessionToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const expectedToken = getExpectedSessionToken();

  if (!adminPassword && !expectedToken) {
    return NextResponse.json({ error: 'ADMIN_PASSWORD לא מוגדר ב־.env.local' }, { status: 500 });
  }

  const { password } = await req.json();
  if (!password || hashPassword(password) !== expectedToken) {
    return NextResponse.json({ error: 'סיסמה שגויה' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('admin_session', expectedToken!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
  return res;
}
