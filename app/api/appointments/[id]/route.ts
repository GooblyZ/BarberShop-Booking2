import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { timeToMinutes, hasOverlap, isValidIsraeliPhone } from '@/lib/services';
import type { Service } from '@/lib/services';
import type { Appointment } from '@/app/api/appointments/route';

const VALID_STATUSES = ['confirmed', 'cancelled_by_admin', 'cancelled_by_customer', 'completed'];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { status, note, cancel_reason, name, phone, service_id, date, time } = body;

  const isFullEdit = name !== undefined || phone !== undefined ||
                     service_id !== undefined || date !== undefined || time !== undefined;

  if (!isFullEdit && status === undefined && note === undefined && cancel_reason === undefined) {
    return NextResponse.json({ error: 'אין שדות לעדכון' }, { status: 400 });
  }

  const db = getDb();

  if (isFullEdit) {
    // Phone validation
    const digitsOnly = String(phone).replace(/\D/g, '');
    if (!isValidIsraeliPhone(digitsOnly)) {
      return NextResponse.json({ error: 'מספר טלפון לא תקין (לדוגמה: 0501234567)' }, { status: 400 });
    }

    // Service lookup
    const service = db.prepare('SELECT * FROM services WHERE id = ? AND active = 1').get(Number(service_id)) as Service | undefined;
    if (!service) return NextResponse.json({ error: 'שירות לא תקין' }, { status: 400 });

    // Settings
    const settingsRow = db.prepare('SELECT open_hour, close_hour, working_days FROM settings WHERE id = 1').get() as any;

    // Working day check
    const dayOfWeek   = new Date(date + 'T12:00:00').getDay();
    const workingDays = JSON.parse(settingsRow.working_days) as number[];
    if (!workingDays.includes(dayOfWeek)) {
      return NextResponse.json({ error: 'יום זה אינו יום עבודה' }, { status: 400 });
    }

    // Day off check
    if (db.prepare('SELECT 1 FROM days_off WHERE date = ?').get(date)) {
      return NextResponse.json({ error: 'יום זה מסומן כחופשה' }, { status: 400 });
    }

    // Hours check
    const openMins  = settingsRow.open_hour  * 60;
    const closeMins = settingsRow.close_hour * 60;
    const newStart  = timeToMinutes(time);
    const newEnd    = newStart + service.duration;
    if (newStart < openMins || newEnd > closeMins) {
      return NextResponse.json({ error: 'השעה מחוץ לשעות הפעילות' }, { status: 400 });
    }

    // Blocked ranges check
    const blocked = db.prepare(
      'SELECT * FROM blocked_ranges WHERE date = ? OR date IS NULL'
    ).all(date) as { start_time: string; end_time: string }[];
    for (const r of blocked) {
      const rStart    = timeToMinutes(r.start_time);
      const rDuration = timeToMinutes(r.end_time) - rStart;
      if (hasOverlap(newStart, service.duration, rStart, rDuration)) {
        return NextResponse.json({ error: 'שעה זו חסומה' }, { status: 409 });
      }
    }

    // Existing appointments check — exclude self and cancelled
    const existing = db.prepare(
      "SELECT * FROM appointments WHERE date = ? AND status = 'confirmed' AND id != ?"
    ).all(date, Number(id)) as Appointment[];
    for (const appt of existing) {
      if (hasOverlap(newStart, service.duration, timeToMinutes(appt.time), appt.duration)) {
        return NextResponse.json({ error: 'השעה כבר תפוסה' }, { status: 409 });
      }
    }

    const r = db.prepare(
      'UPDATE appointments SET name = ?, phone = ?, service = ?, date = ?, time = ?, duration = ? WHERE id = ?'
    ).run(name, digitsOnly, service.name, date, time, service.duration, Number(id));
    if (r.changes === 0) return NextResponse.json({ error: 'תור לא נמצא' }, { status: 404 });

    if (note !== undefined) {
      db.prepare('UPDATE appointments SET note = ? WHERE id = ?').run(note || null, Number(id));
    }

    return NextResponse.json({ ok: true });
  }

  // ── Status / note / cancel_reason updates ──────────────────────
  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'סטטוס לא תקין' }, { status: 400 });
    }
    const r = db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(status, Number(id));
    if (r.changes === 0) return NextResponse.json({ error: 'תור לא נמצא' }, { status: 404 });
  }

  if (cancel_reason !== undefined) {
    db.prepare('UPDATE appointments SET cancel_reason = ? WHERE id = ?').run(cancel_reason || null, Number(id));
  }

  if (note !== undefined) {
    const r = db.prepare('UPDATE appointments SET note = ? WHERE id = ?').run(note || null, Number(id));
    if (r.changes === 0) return NextResponse.json({ error: 'תור לא נמצא' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const result = db.prepare('DELETE FROM appointments WHERE id = ?').run(Number(id));
  if (result.changes === 0) {
    return NextResponse.json({ error: 'תור לא נמצא' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
