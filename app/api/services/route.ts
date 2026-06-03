import { NextRequest, NextResponse } from 'next/server';
import type { Service } from '@/lib/services';

// Demo-safe fallback used when DB is unavailable (Vercel, cold start, etc.)
const DEMO_SERVICES: Service[] = [
  { id: 1, name: 'תספורת גברית',  duration: 30, price: 80,  active: 1, sort_order: 0 },
  { id: 2, name: 'עיצוב זקן',      duration: 20, price: 50,  active: 1, sort_order: 1 },
  { id: 3, name: 'תספורת + זקן',   duration: 45, price: 120, active: 1, sort_order: 2 },
  { id: 4, name: 'תספורת ילד',     duration: 25, price: 60,  active: 1, sort_order: 3 },
];

export async function GET(req: NextRequest) {
  try {
    const { getDb } = await import('@/lib/db');
    const db = getDb();
    const activeOnly = req.nextUrl.searchParams.get('active') === '1';
    const rows = activeOnly
      ? db.prepare('SELECT * FROM services WHERE active = 1 ORDER BY sort_order, id').all()
      : db.prepare('SELECT * FROM services ORDER BY sort_order, id').all();
    const services = rows as Service[];
    return NextResponse.json(services.length > 0 ? services : DEMO_SERVICES);
  } catch (err) {
    console.error('[services] DB error, returning demo services:', String(err));
    return NextResponse.json(DEMO_SERVICES);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, duration, price } = await req.json();
    if (!name || !duration) {
      return NextResponse.json({ error: 'שם ומשך חובה' }, { status: 400 });
    }
    const { getDb } = await import('@/lib/db');
    const db = getDb();
    const { maxOrder } = db.prepare(
      'SELECT MAX(sort_order) as maxOrder FROM services'
    ).get() as { maxOrder: number | null };
    const result = db.prepare(
      'INSERT INTO services (name, duration, price, active, sort_order) VALUES (?, ?, ?, 1, ?)'
    ).run(name, Number(duration), price ? Number(price) : null, (maxOrder ?? -1) + 1);
    return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 });
  } catch (err) {
    console.error('[services POST] error:', String(err));
    return NextResponse.json({ error: 'שגיאה ביצירת שירות' }, { status: 500 });
  }
}
