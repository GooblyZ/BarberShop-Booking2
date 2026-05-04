import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params;
  getDb().prepare('DELETE FROM days_off WHERE date = ?').run(date);
  return NextResponse.json({ ok: true });
}
