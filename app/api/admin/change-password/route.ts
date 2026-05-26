import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, getExpectedSessionToken } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { currentPassword, newPassword } = await req.json();

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'שדות חסרים' }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: 'הסיסמה חייבת להכיל לפחות 6 תווים' }, { status: 400 });
  }

  const expectedToken = getExpectedSessionToken();
  if (!expectedToken || hashPassword(currentPassword) !== expectedToken) {
    return NextResponse.json({ error: 'הסיסמה הנוכחית שגויה' }, { status: 401 });
  }

  const newHash = hashPassword(newPassword);
  const db = getDb();
  db.prepare('UPDATE settings SET admin_password_hash = ? WHERE id = 1').run(newHash);

  const res = NextResponse.json({ ok: true });
  res.cookies.set('admin_session', newHash, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
  return res;
}
