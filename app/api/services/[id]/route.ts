import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { name, duration, price, active } = await req.json();
  if (!name || !duration) {
    return NextResponse.json({ error: 'שם ומשך חובה' }, { status: 400 });
  }
  const db = getDb();
  const result = db.prepare(
    'UPDATE services SET name = ?, duration = ?, price = ?, active = ? WHERE id = ?'
  ).run(name, Number(duration), price != null ? Number(price) : null, active ? 1 : 0, Number(id));
  if (result.changes === 0) {
    return NextResponse.json({ error: 'שירות לא נמצא' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
