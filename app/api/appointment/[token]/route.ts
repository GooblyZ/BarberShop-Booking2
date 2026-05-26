import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const db = getDb();
  const appt = db.prepare(
    'SELECT name, service, date, time, duration, status, cancel_reason FROM appointments WHERE token = ?'
  ).get(token);

  if (!appt) return NextResponse.json({ error: 'תור לא נמצא' }, { status: 404 });
  return NextResponse.json(appt);
}
