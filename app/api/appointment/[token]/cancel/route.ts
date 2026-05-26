import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const db = getDb();

  const appt = db.prepare('SELECT id, status FROM appointments WHERE token = ?').get(token) as
    { id: number; status: string } | undefined;

  if (!appt) return NextResponse.json({ error: 'תור לא נמצא' }, { status: 404 });
  if (appt.status !== 'confirmed') {
    return NextResponse.json({ error: 'לא ניתן לבטל תור זה' }, { status: 400 });
  }

  db.prepare("UPDATE appointments SET status = 'cancelled_by_customer' WHERE id = ?").run(appt.id);
  return NextResponse.json({ ok: true });
}
