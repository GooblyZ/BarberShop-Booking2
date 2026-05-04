'use client';

import { useEffect, useState } from 'react';
import type { Appointment } from '@/app/api/appointments/route';

interface BlockedRange {
  id: number;
  start_time: string;
  end_time: string;
  date: string | null;
}

interface Settings {
  open_hour: number;
  close_hour: number;
  working_days: number[];
}

const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HOURS   = Array.from({ length: 17 }, (_, i) => i + 6); // 6–22

export default function AdminPage() {
  const [tab, setTab] = useState<'appointments' | 'settings'>('appointments');

  // ── Appointments ──────────────────────────────────────────────────
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [apptLoading, setApptLoading]   = useState(true);

  async function loadAppointments() {
    setApptLoading(true);
    const res = await fetch('/api/appointments');
    setAppointments(await res.json());
    setApptLoading(false);
  }

  useEffect(() => { loadAppointments(); }, []);

  async function handleDelete(id: number) {
    const appt = appointments.find(a => a.id === id);
    if (!appt) return;
    const confirmed = confirm(
      `למחוק את התור של ${appt.name}?\n${appt.date} בשעה ${appt.time} — ${appt.service}`
    );
    if (!confirmed) return;
    await fetch(`/api/appointments/${id}`, { method: 'DELETE' });
    setAppointments(prev => prev.filter(a => a.id !== id));
  }

  const byDate = appointments.reduce<Record<string, Appointment[]>>((acc, a) => {
    (acc[a.date] ??= []).push(a);
    return acc;
  }, {});

  // ── Settings ───────────────────────────────────────────────────────
  const [settings, setSettings]           = useState<Settings>({ open_hour: 9, close_hour: 18, working_days: [0,1,2,3,4,5] });
  const [daysOff, setDaysOff]             = useState<string[]>([]);
  const [blockedRanges, setBlockedRanges] = useState<BlockedRange[]>([]);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [savedMsg, setSavedMsg]           = useState('');
  const [newDayOff, setNewDayOff]         = useState('');
  const [newRange, setNewRange]           = useState({ start_time: '12:00', end_time: '13:00', date: '' });

  async function loadSettings() {
    if (settingsLoaded) return;
    const [s, d, b] = await Promise.all([
      fetch('/api/settings').then(r => r.json()),
      fetch('/api/days-off').then(r => r.json()),
      fetch('/api/blocked-ranges').then(r => r.json()),
    ]);
    setSettings(s);
    setDaysOff(d);
    setBlockedRanges(b);
    setSettingsLoaded(true);
  }

  function handleTabChange(t: 'appointments' | 'settings') {
    setTab(t);
    if (t === 'settings') loadSettings();
  }

  function showSaved() {
    setSavedMsg('נשמר ✓');
    setTimeout(() => setSavedMsg(''), 2000);
  }

  async function saveWorkingHours() {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    showSaved();
  }

  function toggleDay(day: number) {
    setSettings(prev => ({
      ...prev,
      working_days: prev.working_days.includes(day)
        ? prev.working_days.filter(d => d !== day)
        : [...prev.working_days, day].sort(),
    }));
  }

  async function addDayOff() {
    if (!newDayOff) return;
    await fetch('/api/days-off', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: newDayOff }),
    });
    setDaysOff(prev => [...new Set([...prev, newDayOff])].sort());
    setNewDayOff('');
  }

  async function removeDayOff(date: string) {
    await fetch(`/api/days-off/${date}`, { method: 'DELETE' });
    setDaysOff(prev => prev.filter(d => d !== date));
  }

  async function addBlockedRange() {
    if (!newRange.start_time || !newRange.end_time) return;
    const res = await fetch('/api/blocked-ranges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newRange, date: newRange.date || null }),
    });
    if (!res.ok) return;
    const { id } = await res.json();
    setBlockedRanges(prev => [...prev, { id, ...newRange, date: newRange.date || null }]);
    setNewRange({ start_time: '12:00', end_time: '13:00', date: '' });
  }

  async function removeBlockedRange(id: number) {
    await fetch(`/api/blocked-ranges/${id}`, { method: 'DELETE' });
    setBlockedRanges(prev => prev.filter(r => r.id !== id));
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">מספרה — ניהול</h1>
        <a href="/" className="text-sm text-blue-600 hover:underline">← חזרה לאתר</a>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b">
        <button
          onClick={() => handleTabChange('appointments')}
          className={`pb-2 px-4 font-medium border-b-2 transition-colors
            ${tab === 'appointments' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          📋 תורים
        </button>
        <button
          onClick={() => handleTabChange('settings')}
          className={`pb-2 px-4 font-medium border-b-2 transition-colors
            ${tab === 'settings' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          ⚙️ הגדרות
        </button>
      </div>

      {/* ── APPOINTMENTS TAB ── */}
      {tab === 'appointments' && (
        <div>
          {apptLoading && <p className="text-gray-400">טוען...</p>}
          {!apptLoading && appointments.length === 0 && (
            <p className="text-gray-400 text-center py-16">אין תורים קבועים</p>
          )}
          {Object.entries(byDate)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, appts]) => (
              <div key={date} className="mb-8">
                <h2 className="text-lg font-semibold text-gray-700 mb-3 border-b pb-1">
                  {new Date(date + 'T12:00:00').toLocaleDateString('he-IL', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                  })}
                </h2>
                <div className="grid gap-2">
                  {appts.map(a => (
                    <div key={a.id}
                      className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm">
                      <div>
                        <span className="font-bold text-blue-700 ml-3">{a.time}</span>
                        <span className="font-medium">{a.name}</span>
                        <span className="text-gray-400 text-sm mr-3"> | {a.phone}</span>
                        <span className="text-gray-500 text-sm">{a.service}</span>
                      </div>
                      <button
                        onClick={() => handleDelete(a.id)}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 px-3 py-1 rounded-lg transition-colors text-sm">
                        מחק
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* ── SETTINGS TAB ── */}
      {tab === 'settings' && (
        <div className="grid gap-6">
          {savedMsg && (
            <div className="bg-green-100 text-green-700 px-4 py-2 rounded-lg text-center font-medium">
              {savedMsg}
            </div>
          )}

          {/* Working hours */}
          <section className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="font-semibold text-lg mb-4">🕐 שעות עבודה</h2>
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2">
                <span className="text-sm font-medium">פתיחה</span>
                <select
                  value={settings.open_hour}
                  onChange={e => setSettings(p => ({ ...p, open_hour: Number(e.target.value) }))}
                  className="border border-gray-300 rounded-lg px-3 py-2">
                  {HOURS.filter(h => h < settings.close_hour).map(h => (
                    <option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2">
                <span className="text-sm font-medium">סגירה</span>
                <select
                  value={settings.close_hour}
                  onChange={e => setSettings(p => ({ ...p, close_hour: Number(e.target.value) }))}
                  className="border border-gray-300 rounded-lg px-3 py-2">
                  {HOURS.filter(h => h > settings.open_hour).map(h => (
                    <option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>
                  ))}
                </select>
              </label>
              <button onClick={saveWorkingHours}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                שמור
              </button>
            </div>
          </section>

          {/* Working days */}
          <section className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="font-semibold text-lg mb-4">📅 ימי עבודה</h2>
            <div className="flex flex-wrap gap-2 mb-4">
              {DAYS_HE.map((name, idx) => (
                <button
                  key={idx}
                  onClick={() => toggleDay(idx)}
                  className={`px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-colors
                    ${settings.working_days.includes(idx)
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-gray-200 text-gray-600 hover:border-blue-400'}`}>
                  {name}
                </button>
              ))}
            </div>
            <button onClick={saveWorkingHours}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              שמור
            </button>
          </section>

          {/* Days off */}
          <section className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="font-semibold text-lg mb-4">🚫 ימי חופש / חגים</h2>
            <div className="flex gap-2 mb-4">
              <input
                type="date"
                value={newDayOff}
                onChange={e => setNewDayOff(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <button onClick={addDayOff} disabled={!newDayOff}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-blue-700">
                הוסף
              </button>
            </div>
            {daysOff.length === 0
              ? <p className="text-gray-400 text-sm">אין ימי חופש מוגדרים</p>
              : daysOff.map(d => (
                  <div key={d} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm">{new Date(d + 'T12:00:00').toLocaleDateString('he-IL', {
                      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                    })}</span>
                    <button onClick={() => removeDayOff(d)}
                      className="text-red-400 hover:text-red-600 text-sm px-2 py-1 rounded hover:bg-red-50">
                      הסר
                    </button>
                  </div>
                ))}
          </section>

          {/* Blocked time ranges */}
          <section className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="font-semibold text-lg mb-1">⏱ טווחי זמן חסומים</h2>
            <p className="text-gray-400 text-xs mb-4">ללא תאריך = חוזר כל יום עבודה</p>
            <div className="flex flex-wrap gap-2 mb-4">
              <input type="time" value={newRange.start_time}
                onChange={e => setNewRange(p => ({ ...p, start_time: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <span className="flex items-center text-gray-400">עד</span>
              <input type="time" value={newRange.end_time}
                onChange={e => setNewRange(p => ({ ...p, end_time: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <input type="date" value={newRange.date}
                onChange={e => setNewRange(p => ({ ...p, date: e.target.value }))}
                placeholder="תאריך (אופציונלי)"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <button onClick={addBlockedRange}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                הוסף
              </button>
            </div>
            {blockedRanges.length === 0
              ? <p className="text-gray-400 text-sm">אין טווחים חסומים</p>
              : blockedRanges.map(r => (
                  <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm">
                      {r.start_time}–{r.end_time}
                      <span className="text-gray-400 mr-2">
                        {r.date
                          ? new Date(r.date + 'T12:00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })
                          : 'כל יום'}
                      </span>
                    </span>
                    <button onClick={() => removeBlockedRange(r.id)}
                      className="text-red-400 hover:text-red-600 text-sm px-2 py-1 rounded hover:bg-red-50">
                      הסר
                    </button>
                  </div>
                ))}
          </section>
        </div>
      )}
    </main>
  );
}
