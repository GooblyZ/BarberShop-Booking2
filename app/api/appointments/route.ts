import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { timeToMinutes, hasOverlap, isValidIsraeliPhone } from '@/lib/services';
import type { Service } from '@/lib/services';
import crypto from 'crypto';

export interface Appointment {
  id: number;
  name: string;
  phone: string;
  service: string;
  date: string;
  time: string;
  duration: number;
  created_at: string;
  status: string;
  note: string | null;
  token: string;
  cancel_reason: string | null;
}

export async function GET(req: NextRequest) {
  const db   = getDb();
  const date = req.nextUrl.searchParams.get('date');

  if (date) {
    return NextResponse.json(
      db.prepare('SELECT * FROM appointments WHERE date = ? ORDER BY time').all(date) as Appointment[]
    );
  }
  return NextResponse.json(
    db.prepare('SELECT * FROM appointments ORDER BY date, time').all() as Appointment[]
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, phone, serviceId, date, time, note } = body;

  if (!name || !phone || !serviceId || !date || !time) {
    return NextResponse.json({ error: 'שדות חסרים' }, { status: 400 });
  }

  // Phone validation
  const digitsOnly = String(phone).replace(/\D/g, '');
  if (!isValidIsraeliPhone(digitsOnly)) {
    return NextResponse.json({ error: 'מספר טלפון לא תקין (לדוגמה: 0501234567)' }, { status: 400 });
  }

  const db = getDb();
  const service = db.prepare('SELECT * FROM services WHERE id = ? AND active = 1').get(Number(serviceId)) as Service | undefined;
  if (!service) {
    return NextResponse.json({ error: 'שירות לא תקין' }, { status: 400 });
  }
  const settingsRow = db.prepare('SELECT open_hour, close_hour, working_days FROM settings WHERE id = 1').get() as any;
  const openMins  = settingsRow.open_hour  * 60;
  const closeMins = settingsRow.close_hour * 60;

  // Day of week check
  const dayOfWeek    = new Date(date + 'T12:00:00').getDay();
  const workingDays  = JSON.parse(settingsRow.working_days) as number[];
  if (!workingDays.includes(dayOfWeek)) {
    return NextResponse.json({ error: 'יום זה אינו יום עבודה' }, { status: 400 });
  }

  // Day off check
  if (db.prepare('SELECT 1 FROM days_off WHERE date = ?').get(date)) {
    return NextResponse.json({ error: 'יום זה מסומן כחופשה' }, { status: 400 });
  }

  const newStart    = timeToMinutes(time);
  const newDuration = service.duration;
  const newEnd      = newStart + newDuration;

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
    if (hasOverlap(newStart, newDuration, rStart, rDuration)) {
      return NextResponse.json({ error: 'שעה זו חסומה' }, { status: 409 });
    }
  }

  // Existing appointments check (skip cancelled)
  const existing = db.prepare(
    "SELECT * FROM appointments WHERE date = ? AND status = 'confirmed'"
  ).all(date) as Appointment[];
  for (const appt of existing) {
    if (hasOverlap(newStart, newDuration, timeToMinutes(appt.time), appt.duration)) {
      return NextResponse.json({ error: 'השעה כבר תפוסה' }, { status: 409 });
    }
  }

  const token = crypto.randomBytes(16).toString('hex');
  const result = db.prepare(
    'INSERT INTO appointments (name, phone, service, date, time, duration, token, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(name, digitsOnly, service.name, date, time, newDuration, token, note || null);

  return NextResponse.json({ id: result.lastInsertRowid, token }, { status: 201 });
}
