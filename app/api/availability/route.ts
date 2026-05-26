import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { Appointment } from '@/app/api/appointments/route';
import type { BlockedRange } from '@/app/api/blocked-ranges/route';
import type { Settings } from '@/app/api/settings/route';

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date');
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 });

  const db = getDb();

  const row = db.prepare('SELECT open_hour, close_hour, working_days FROM settings WHERE id = 1').get() as any;
  const settings: Settings = {
    open_hour:    row.open_hour,
    close_hour:   row.close_hour,
    working_days: JSON.parse(row.working_days),
  };

  // 0 = Sunday ... 6 = Saturday
  const dayOfWeek    = new Date(date + 'T12:00:00').getDay();
  const nonWorkingDay = !settings.working_days.includes(dayOfWeek);
  const dayOff        = !!db.prepare('SELECT 1 FROM days_off WHERE date = ?').get(date);

  const booked = db.prepare(
    "SELECT * FROM appointments WHERE date = ? AND status = 'confirmed' ORDER BY time"
  ).all(date) as Appointment[];

  const blockedRanges = db.prepare(
    'SELECT * FROM blocked_ranges WHERE date = ? OR date IS NULL ORDER BY start_time'
  ).all(date) as BlockedRange[];

  return NextResponse.json({ settings, nonWorkingDay, dayOff, booked, blockedRanges });
}
