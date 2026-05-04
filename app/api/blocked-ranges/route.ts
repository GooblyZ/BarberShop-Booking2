import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export interface BlockedRange {
  id: number;
  start_time: string;
  end_time: string;
  date: string | null;
}

export async function GET() {
  const rows = getDb()
    .prepare('SELECT * FROM blocked_ranges ORDER BY date, start_time')
    .all() as BlockedRange[];
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { start_time, end_time, date } = await req.json();

  if (!start_time || !end_time) {
    return NextResponse.json({ error: 'שדות חסרים' }, { status: 400 });
  }
  if (start_time >= end_time) {
    return NextResponse.json({ error: 'שעת סיום חייבת להיות אחרי שעת התחלה' }, { status: 400 });
  }

  const result = getDb()
    .prepare('INSERT INTO blocked_ranges (start_time, end_time, date) VALUES (?, ?, ?)')
    .run(start_time, end_time, date || null);

  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 });
}
