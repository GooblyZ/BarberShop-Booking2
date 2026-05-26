import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { Service } from '@/lib/services';

export async function GET(req: NextRequest) {
  const db = getDb();
  const activeOnly = req.nextUrl.searchParams.get('active') === '1';
  const rows = activeOnly
    ? db.prepare('SELECT * FROM services WHERE active = 1 ORDER BY sort_order, id').all()
    : db.prepare('SELECT * FROM services ORDER BY sort_order, id').all();
  return NextResponse.json(rows as Service[]);
}

export async function POST(req: NextRequest) {
  const { name, duration, price } = await req.json();
  if (!name || !duration) {
    return NextResponse.json({ error: 'שם ומשך חובה' }, { status: 400 });
  }
  const db = getDb();
  const { maxOrder } = db.prepare('SELECT MAX(sort_order) as maxOrder FROM services').get() as { maxOrder: number | null };
  const result = db.prepare(
    'INSERT INTO services (name, duration, price, active, sort_order) VALUES (?, ?, ?, 1, ?)'
  ).run(name, Number(duration), price ? Number(price) : null, (maxOrder ?? -1) + 1);
  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 });
}
