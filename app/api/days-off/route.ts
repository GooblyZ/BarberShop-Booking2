import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const rows = getDb().prepare('SELECT date FROM days_off ORDER BY date').all() as { date: string }[];
  return NextResponse.json(rows.map(r => r.date));
}

export async function POST(req: NextRequest) {
  const { date } = await req.json();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'תאריך לא תקין' }, { status: 400 });
  }
  getDb().prepare('INSERT OR IGNORE INTO days_off (date) VALUES (?)').run(date);
  return NextResponse.json({ ok: true });
}
