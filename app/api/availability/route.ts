import { NextRequest, NextResponse } from 'next/server';
import { generateSlots, timeToMinutes, hasOverlap } from '@/lib/services';

const DEFAULT_OPEN         = 9;
const DEFAULT_CLOSE        = 18;
const DEFAULT_WORKING_DAYS = [0, 1, 2, 3, 4, 5]; // Sun–Fri

export async function GET(req: NextRequest) {
  const date     = req.nextUrl.searchParams.get('date');
  const durParam = req.nextUrl.searchParams.get('duration');

  if (!date || !durParam) {
    return NextResponse.json({ error: 'date and duration required' }, { status: 400 });
  }
  const duration = Number(durParam);
  if (!Number.isFinite(duration) || duration <= 0) {
    return NextResponse.json({ error: 'invalid duration' }, { status: 400 });
  }

  // Deterministic weekday — parse manually to avoid UTC-day-shift
  const [y, m, d] = date.split('-').map(Number);
  const dayOfWeek = new Date(y, m - 1, d).getDay();

  // Defaults used when DB is unavailable (Vercel cold-start, read-only fs, etc.)
  let openHour    = DEFAULT_OPEN;
  let closeHour   = DEFAULT_CLOSE;
  let workingDays = DEFAULT_WORKING_DAYS;
  let dayOff      = false;
  let booked:  { time: string; duration: number }[]       = [];
  let blocked: { start_time: string; end_time: string }[] = [];

  try {
    // Dynamic import so a module-load failure (bad native binary, etc.) is caught here
    const { getDb } = await import('@/lib/db');
    const db = getDb();

    const row = db.prepare(
      'SELECT open_hour, close_hour, working_days FROM settings WHERE id = 1'
    ).get() as { open_hour: number; close_hour: number; working_days: string } | undefined;

    if (row) {
      openHour    = row.open_hour;
      closeHour   = row.close_hour;
      workingDays = JSON.parse(row.working_days) as number[];
    }

    dayOff = !!db.prepare('SELECT 1 FROM days_off WHERE date = ?').get(date);

    booked = db.prepare(
      "SELECT time, duration FROM appointments WHERE date = ? AND status = 'confirmed'"
    ).all(date) as { time: string; duration: number }[];

    blocked = db.prepare(
      'SELECT start_time, end_time FROM blocked_ranges WHERE date = ? OR date IS NULL'
    ).all(date) as { start_time: string; end_time: string }[];

  } catch (err) {
    // DB unavailable — fall through with defaults (empty bookings, default schedule)
    console.error('[availability] DB error, using defaults:', String(err));
  }

  // Non-working day or holiday → empty slot list (not an error)
  if (!workingDays.includes(dayOfWeek) || dayOff) {
    return NextResponse.json({ slots: [] });
  }

  const todayUTC = new Date().toISOString().split('T')[0];
  const nowMins  = new Date().getUTCHours() * 60 + new Date().getUTCMinutes();
  const closeMins = closeHour * 60;

  const slots = generateSlots(openHour, closeHour).filter(slot => {
    const start = timeToMinutes(slot);
    const end   = start + duration;

    if (end > closeMins) return false;
    if (date === todayUTC && start <= nowMins) return false;

    if (blocked.some(r => {
      const rs = timeToMinutes(r.start_time);
      return hasOverlap(start, duration, rs, timeToMinutes(r.end_time) - rs);
    })) return false;

    return !booked.some(b =>
      hasOverlap(start, duration, timeToMinutes(b.time), b.duration)
    );
  });

  return NextResponse.json({ slots });
}
