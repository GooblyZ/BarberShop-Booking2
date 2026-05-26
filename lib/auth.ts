import crypto from 'crypto';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/db';

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function getExpectedSessionToken(): string | null {
  const db = getDb();
  const row = db.prepare('SELECT admin_password_hash FROM settings WHERE id = 1').get() as { admin_password_hash: string | null };
  if (row?.admin_password_hash) return row.admin_password_hash;
  const envPassword = process.env.ADMIN_PASSWORD;
  if (envPassword) return hashPassword(envPassword);
  return null;
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session');
  if (!session?.value) return false;
  const expected = getExpectedSessionToken();
  return !!expected && session.value === expected;
}
