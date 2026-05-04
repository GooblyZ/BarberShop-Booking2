import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export interface Settings {
  open_hour: number;
  close_hour: number;
  working_days: number[];
}

export async function GET() {
  const db  = getDb();
  const row = db.prepare('SELECT open_hour, close_hour, working_days FROM settings WHERE id = 1').get() as any;
  return NextResponse.json({
    open_hour:    row.open_hour,
    close_hour:   row.close_hour,
    working_days: JSON.parse(row.working_days),
  } as Settings);
}

export async function PUT(req: NextRequest) {
  const { open_hour, close_hour, working_days } = await req.json();

  if (
    typeof open_hour    !== 'number' ||
    typeof close_hour   !== 'number' ||
    !Array.isArray(working_days)     ||
    open_hour >= close_hour          ||
    open_hour < 0 || close_hour > 24
  ) {
    return NextResponse.json({ error: 'נתונים לא תקינים' }, { status: 400 });
  }

  getDb()
    .prepare('UPDATE settings SET open_hour = ?, close_hour = ?, working_days = ? WHERE id = 1')
    .run(open_hour, close_hour, JSON.stringify(working_days));

  return NextResponse.json({ ok: true });
}
