'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { generateSlots, timeToMinutes, hasOverlap, isValidIsraeliPhone } from '@/lib/services';
import type { Appointment } from '@/app/api/appointments/route';
import type { Service } from '@/lib/services';

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

interface AvailData {
  settings: Settings;
  nonWorkingDay: boolean;
  dayOff: boolean;
  booked: Appointment[];
  blockedRanges: { start_time: string; end_time: string }[];
}

const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HOURS   = Array.from({ length: 17 }, (_, i) => i + 6);

function computeSlots(avail: AvailData, duration: number, excludeId?: number): string[] {
  const { settings, nonWorkingDay, dayOff, booked, blockedRanges } = avail;
  if (nonWorkingDay || dayOff) return [];
  const closeMins = settings.close_hour * 60;
  return generateSlots(settings.open_hour, settings.close_hour).filter(slot => {
    const start = timeToMinutes(slot);
    const end   = start + duration;
    if (end > closeMins) return false;
    if (blockedRanges.some(r => {
      const rStart = timeToMinutes(r.start_time);
      return hasOverlap(start, duration, rStart, timeToMinutes(r.end_time) - rStart);
    })) return false;
    return !booked.filter(b => b.id !== excludeId).some(b =>
      hasOverlap(start, duration, timeToMinutes(b.time), b.duration)
    );
  });
}

const emptyForm = () => ({ name: '', phone: '', serviceId: 0, date: '', time: '', note: '' });

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'appointments' | 'settings' | 'services'>('appointments');

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
  }

  // ── Appointments ──────────────────────────────────────────────────
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [apptLoading, setApptLoading]   = useState(true);
  const [apptFilter, setApptFilter]     = useState<'upcoming' | 'today' | 'cancelled' | 'all'>('upcoming');
  const [searchQuery, setSearchQuery]   = useState('');
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [noteText, setNoteText]           = useState('');
  const [cancellingId, setCancellingId]   = useState<number | null>(null);
  const [cancelReason, setCancelReason]   = useState('');
  const [copiedId, setCopiedId]           = useState<number | null>(null);

  // Edit appointment
  const [editingApptId, setEditingApptId]       = useState<number | null>(null);
  const [editForm, setEditForm]                 = useState(emptyForm());
  const [editAvailability, setEditAvailability] = useState<AvailData | null>(null);
  const [editPhoneError, setEditPhoneError]     = useState('');
  const [editError, setEditError]               = useState('');
  const [editSaving, setEditSaving]             = useState(false);

  // Create appointment
  const [creatingAppt, setCreatingAppt]           = useState(false);
  const [createForm, setCreateForm]               = useState(emptyForm());
  const [createAvailability, setCreateAvailability] = useState<AvailData | null>(null);
  const [createPhoneError, setCreatePhoneError]   = useState('');
  const [createError, setCreateError]             = useState('');
  const [createSaving, setCreateSaving]           = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];
  const nowMins  = new Date().getHours() * 60 + new Date().getMinutes();

  // ── Services (loaded on mount alongside appointments) ─────────────
  const [services, setServices]             = useState<Service[]>([]);
  const [servicesLoaded, setServicesLoaded] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [newService, setNewService]         = useState({ name: '', duration: 30, price: '' });
  const [serviceMsg, setServiceMsg]         = useState('');

  async function loadAppointments() {
    setApptLoading(true);
    const [apptRes, svcRes] = await Promise.all([
      fetch('/api/appointments'),
      fetch('/api/services'),
    ]);
    setAppointments(await apptRes.json());
    const svcs = await svcRes.json();
    setServices(svcs);
    setServicesLoaded(true);
    setApptLoading(false);
  }

  useEffect(() => { loadAppointments(); }, []);

  // Fetch availability when edit form date changes
  useEffect(() => {
    if (!editForm.date) { setEditAvailability(null); return; }
    fetch(`/api/availability?date=${editForm.date}`)
      .then(r => r.json()).then(setEditAvailability);
  }, [editForm.date]);

  // Fetch availability when create form date changes
  useEffect(() => {
    if (!createForm.date) { setCreateAvailability(null); return; }
    fetch(`/api/availability?date=${createForm.date}`)
      .then(r => r.json()).then(setCreateAvailability);
  }, [createForm.date]);

  async function confirmCancel(id: number) {
    await fetch(`/api/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled_by_admin', cancel_reason: cancelReason || undefined }),
    });
    setAppointments(prev => prev.map(a =>
      a.id === id ? { ...a, status: 'cancelled_by_admin', cancel_reason: cancelReason || null } : a
    ));
    setCancellingId(null);
    setCancelReason('');
  }

  function copyAppointmentLink(token: string, id: number) {
    navigator.clipboard.writeText(`${window.location.origin}/appointment/${token}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleComplete(id: number) {
    await fetch(`/api/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'completed' } : a));
  }

  async function saveNote(id: number) {
    await fetch(`/api/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: noteText }),
    });
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, note: noteText || null } : a));
    setEditingNoteId(null);
  }

  function startEditing(a: Appointment) {
    const svc = services.find(s => s.name === a.service);
    setEditAvailability(null);
    setEditPhoneError('');
    setEditError('');
    setEditingApptId(a.id);
    setEditForm({
      name:      a.name,
      phone:     a.phone,
      serviceId: svc?.id ?? 0,
      date:      a.date,
      time:      a.time,
      note:      a.note ?? '',
    });
    // Manual fetch in case date doesn't change from previous edit form value
    fetch(`/api/availability?date=${a.date}`)
      .then(r => r.json()).then(setEditAvailability);
  }

  async function saveEditAppt(id: number) {
    const digits = editForm.phone.replace(/\D/g, '');
    if (!isValidIsraeliPhone(digits)) {
      setEditPhoneError('מספר טלפון לא תקין (לדוגמה: 0501234567)');
      return;
    }
    setEditSaving(true);
    setEditError('');
    const res = await fetch(`/api/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:       editForm.name,
        phone:      digits,
        service_id: editForm.serviceId,
        date:       editForm.date,
        time:       editForm.time,
        note:       editForm.note,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setEditError(data.error || 'שגיאה בעדכון');
    } else {
      const svc = services.find(s => s.id === editForm.serviceId);
      setAppointments(prev => prev.map(a => a.id === id ? {
        ...a,
        name:     editForm.name,
        phone:    digits,
        service:  svc?.name ?? a.service,
        date:     editForm.date,
        time:     editForm.time,
        duration: svc?.duration ?? a.duration,
        note:     editForm.note || null,
      } : a));
      setEditingApptId(null);
    }
    setEditSaving(false);
  }

  async function saveCreateAppt() {
    const digits = createForm.phone.replace(/\D/g, '');
    if (!isValidIsraeliPhone(digits)) {
      setCreatePhoneError('מספר טלפון לא תקין (לדוגמה: 0501234567)');
      return;
    }
    setCreateSaving(true);
    setCreateError('');
    const res = await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:      createForm.name,
        phone:     digits,
        serviceId: createForm.serviceId,
        date:      createForm.date,
        time:      createForm.time,
        note:      createForm.note || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setCreateError(data.error || 'שגיאה ביצירת התור');
    } else {
      await loadAppointments();
      setCreatingAppt(false);
      setCreateForm(emptyForm());
      setCreateAvailability(null);
    }
    setCreateSaving(false);
  }

  const filteredAppointments = appointments
    .filter(a => {
      if (apptFilter === 'today')     return a.date === todayStr;
      if (apptFilter === 'upcoming')  return a.status === 'confirmed' && a.date >= todayStr;
      if (apptFilter === 'cancelled') return a.status.startsWith('cancelled');
      return true;
    })
    .filter(a => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return a.name.toLowerCase().includes(q) ||
             a.phone.includes(q) ||
             a.service.toLowerCase().includes(q);
    });

  const byDate = filteredAppointments.reduce<Record<string, Appointment[]>>((acc, a) => {
    (acc[a.date] ??= []).push(a);
    return acc;
  }, {});

  // Next upcoming appointment ID for today-view highlight
  const nextApptId = apptFilter === 'today'
    ? [...filteredAppointments]
        .filter(a => a.status === 'confirmed' && timeToMinutes(a.time) > nowMins)
        .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time))[0]?.id ?? null
    : null;

  // Slot computation for edit / create forms
  const editService   = services.find(s => s.id === editForm.serviceId);
  const editSlots     = editAvailability && editService
    ? computeSlots(editAvailability, editService.duration, editingApptId ?? undefined)
    : [];

  const createService = services.find(s => s.id === createForm.serviceId);
  const createSlots   = createAvailability && createService
    ? computeSlots(createAvailability, createService.duration)
    : [];

  // ── Settings ───────────────────────────────────────────────────────
  const [settings, setSettings]             = useState<Settings>({ open_hour: 9, close_hour: 18, working_days: [0,1,2,3,4,5] });
  const [daysOff, setDaysOff]               = useState<string[]>([]);
  const [blockedRanges, setBlockedRanges]   = useState<BlockedRange[]>([]);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [savedMsg, setSavedMsg]             = useState('');
  const [newDayOff, setNewDayOff]           = useState('');
  const [newRange, setNewRange]             = useState({ start_time: '12:00', end_time: '13:00', date: '' });
  const [pwForm, setPwForm]                 = useState({ current: '', next: '', confirm: '' });
  const [pwMsg, setPwMsg]                   = useState<{ text: string; ok: boolean } | null>(null);

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

  async function loadServices() {
    if (servicesLoaded) return;
    const res = await fetch('/api/services');
    setServices(await res.json());
    setServicesLoaded(true);
  }

  function handleTabChange(t: 'appointments' | 'settings' | 'services') {
    setTab(t);
    if (t === 'settings') loadSettings();
    if (t === 'services') loadServices();
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
        <div className="flex items-center gap-3">
          <a href="/" className="text-sm text-blue-600 hover:underline">← חזרה לאתר</a>
          <button onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-300 px-3 py-1.5 rounded-lg transition-colors">
            יציאה
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b">
        {(['appointments', 'settings', 'services'] as const).map(t => (
          <button key={t} onClick={() => handleTabChange(t)}
            className={`pb-2 px-4 font-medium border-b-2 transition-colors
              ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'appointments' ? '📋 תורים' : t === 'settings' ? '⚙️ הגדרות' : '✂️ שירותים'}
          </button>
        ))}
      </div>

      {/* ── APPOINTMENTS TAB ── */}
      {tab === 'appointments' && (
        <div>
          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="🔍 חיפוש לפי שם, טלפון או שירות..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm"
            />
          </div>

          {/* Filter bar + New appointment button */}
          <div className="flex gap-2 mb-5 flex-wrap items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              {([
                ['upcoming',  'קרובים'],
                ['today',     'היום'],
                ['cancelled', 'בוטלו'],
                ['all',       'הכל'],
              ] as const).map(([val, label]) => (
                <button key={val} onClick={() => setApptFilter(val)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors
                    ${apptFilter === val
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'}`}>
                  {label}
                  <span className="mr-1.5 text-xs opacity-70">
                    ({appointments.filter(a => {
                      if (val === 'today')     return a.date === todayStr;
                      if (val === 'upcoming')  return a.status === 'confirmed' && a.date >= todayStr;
                      if (val === 'cancelled') return a.status.startsWith('cancelled');
                      return true;
                    }).length})
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setCreatingAppt(v => !v);
                setCreateForm(emptyForm());
                setCreateAvailability(null);
                setCreateError('');
                setCreatePhoneError('');
              }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors
                ${creatingAppt
                  ? 'bg-gray-100 text-gray-600 border-gray-300'
                  : 'border-blue-300 text-blue-600 hover:bg-blue-50'}`}>
              {creatingAppt ? '✕ סגור' : '+ תור חדש'}
            </button>
          </div>

          {/* ── Create appointment form ── */}
          {creatingAppt && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
              <h3 className="font-semibold text-blue-900 mb-4">יצירת תור ידנית</h3>
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">שם לקוח</label>
                    <input type="text" placeholder="ישראל ישראלי"
                      value={createForm.name}
                      onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">טלפון</label>
                    <input type="tel" placeholder="0501234567"
                      value={createForm.phone}
                      onChange={e => {
                        const v = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setCreateForm(p => ({ ...p, phone: v }));
                        setCreatePhoneError(v.length > 0 && !isValidIsraeliPhone(v) ? 'מספר לא תקין' : '');
                      }}
                      className={`w-full border rounded-lg px-3 py-2 text-sm ${createPhoneError ? 'border-red-400' : 'border-gray-300'}`} />
                    {createPhoneError && <p className="text-red-500 text-xs mt-1">{createPhoneError}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">שירות</label>
                  <select value={createForm.serviceId}
                    onChange={e => setCreateForm(p => ({ ...p, serviceId: Number(e.target.value), time: '' }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value={0}>בחר שירות</option>
                    {services.filter(s => s.active).map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.duration} דק׳)</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">תאריך</label>
                  <input type="date"
                    value={createForm.date}
                    onChange={e => setCreateForm(p => ({ ...p, date: e.target.value, time: '' }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>

                {createForm.date && createForm.serviceId > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">שעה</label>
                    {!createAvailability ? (
                      <p className="text-gray-400 text-sm">טוען...</p>
                    ) : createAvailability.nonWorkingDay || createAvailability.dayOff ? (
                      <p className="text-orange-500 text-sm">
                        {createAvailability.nonWorkingDay ? 'יום זה אינו יום עבודה' : 'יום זה מסומן כחופשה'}
                      </p>
                    ) : createSlots.length === 0 ? (
                      <p className="text-red-500 text-sm">אין שעות פנויות בתאריך זה</p>
                    ) : (
                      <div className="grid grid-cols-4 gap-1.5">
                        {createSlots.map(slot => (
                          <button key={slot} onClick={() => setCreateForm(p => ({ ...p, time: slot }))}
                            className={`py-2 rounded-lg border text-sm font-medium transition-colors
                              ${createForm.time === slot
                                ? 'border-blue-600 bg-blue-600 text-white'
                                : 'border-gray-200 hover:border-blue-400'}`}>
                            {slot}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">הערה פנימית (אופציונלי)</label>
                  <input type="text" placeholder="הערה..."
                    value={createForm.note}
                    onChange={e => setCreateForm(p => ({ ...p, note: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>

                {createError && <p className="text-red-500 text-sm">{createError}</p>}

                <div className="flex gap-2">
                  <button onClick={() => { setCreatingAppt(false); setCreateForm(emptyForm()); }}
                    className="flex-1 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
                    ביטול
                  </button>
                  <button
                    disabled={!createForm.name || !createForm.phone || !createForm.serviceId || !createForm.date || !createForm.time || createSaving || !!createPhoneError}
                    onClick={saveCreateAppt}
                    className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-blue-700">
                    {createSaving ? 'שומר...' : 'צור תור'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {apptLoading && <p className="text-gray-400">טוען...</p>}
          {!apptLoading && filteredAppointments.length === 0 && (
            <p className="text-gray-400 text-center py-16">אין תורים בקטגוריה זו</p>
          )}

          {Object.entries(byDate)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, appts]) => (
              <div key={date} className="mb-8">
                <h2 className="text-lg font-semibold text-gray-700 mb-3 border-b pb-1">
                  {new Date(date + 'T12:00:00').toLocaleDateString('he-IL', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                  })}
                  {date === todayStr && (
                    <span className="mr-2 text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">היום</span>
                  )}
                </h2>
                <div className="grid gap-3">
                  {[...appts].sort((a, b) => a.time.localeCompare(b.time)).map(a => {
                    const isCancelled   = a.status?.startsWith('cancelled');
                    const isCompleted   = a.status === 'completed';
                    const isConfirmed   = a.status === 'confirmed';
                    const isEditingNote = editingNoteId === a.id;
                    const isCancelling  = cancellingId === a.id;
                    const isEditing     = editingApptId === a.id;
                    const isNext        = a.id === nextApptId;

                    return (
                      <div key={a.id}
                        className={`border rounded-lg px-4 py-3 shadow-sm transition-all
                          ${isNext      ? 'border-blue-400 ring-2 ring-blue-200 bg-blue-50'
                          : isCancelled ? 'bg-gray-50 border-gray-100 opacity-60'
                          : isCompleted ? 'bg-green-50 border-green-100'
                          : 'bg-white border-gray-200'}`}>

                        {/* Next upcoming badge */}
                        {isNext && (
                          <div className="mb-2">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                              ⏰ הבא בתור
                            </span>
                          </div>
                        )}

                        {/* Main row */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                            <span className={`font-bold text-base shrink-0
                              ${isCancelled ? 'text-gray-400' : isCompleted ? 'text-green-700' : 'text-blue-700'}`}>
                              {a.time}
                            </span>
                            <span className={`font-medium ${isCancelled ? 'line-through text-gray-400' : ''}`}>{a.name}</span>
                            <span className="text-gray-400 text-sm">{a.phone}</span>
                            <span className="text-gray-500 text-sm">{a.service}</span>
                            {isCompleted && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">הושלם</span>
                            )}
                            {isCancelled && (
                              <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                                {a.status === 'cancelled_by_admin' ? 'בוטל ע״י העסק' : 'בוטל ע״י לקוח'}
                              </span>
                            )}
                          </div>

                          {/* Action buttons */}
                          <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
                            {a.token && (
                              <button onClick={() => copyAppointmentLink(a.token, a.id)}
                                title="העתק קישור ללקוח"
                                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors
                                  ${copiedId === a.id
                                    ? 'border-green-300 text-green-600 bg-green-50'
                                    : 'border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-300'}`}>
                                {copiedId === a.id ? '✓ הועתק' : '🔗'}
                              </button>
                            )}
                            {isConfirmed && (
                              <>
                                <button
                                  onClick={() => { if (isEditing) setEditingApptId(null); else startEditing(a); }}
                                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors
                                    ${isEditing
                                      ? 'border-gray-300 text-gray-500 bg-gray-50'
                                      : 'border-blue-200 text-blue-600 hover:bg-blue-50'}`}>
                                  {isEditing ? 'סגור' : 'עריכה'}
                                </button>
                                <button onClick={() => handleComplete(a.id)}
                                  className="text-xs px-2.5 py-1 rounded-lg border border-green-200 text-green-700 hover:bg-green-50 transition-colors">
                                  הושלם ✓
                                </button>
                                <button onClick={() => { setCancellingId(a.id); setCancelReason(''); }}
                                  className="text-xs px-2.5 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
                                  בטל
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Cancel reason */}
                        {a.status === 'cancelled_by_admin' && a.cancel_reason && (
                          <p className="mt-1.5 text-xs text-red-500">סיבה: {a.cancel_reason}</p>
                        )}

                        {/* ── Inline edit form ── */}
                        {isEditing && (
                          <div className="mt-3 bg-white border border-blue-200 rounded-lg p-4">
                            <p className="text-sm font-semibold text-blue-800 mb-3">עריכת תור</p>
                            <div className="grid gap-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 mb-1">שם</label>
                                  <input type="text"
                                    value={editForm.name}
                                    onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 mb-1">טלפון</label>
                                  <input type="tel"
                                    value={editForm.phone}
                                    onChange={e => {
                                      const v = e.target.value.replace(/\D/g, '').slice(0, 10);
                                      setEditForm(p => ({ ...p, phone: v }));
                                      setEditPhoneError(v.length > 0 && !isValidIsraeliPhone(v) ? 'מספר לא תקין' : '');
                                    }}
                                    className={`w-full border rounded-lg px-3 py-1.5 text-sm ${editPhoneError ? 'border-red-400' : 'border-gray-300'}`} />
                                  {editPhoneError && <p className="text-red-500 text-xs mt-1">{editPhoneError}</p>}
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">שירות</label>
                                <select value={editForm.serviceId}
                                  onChange={e => setEditForm(p => ({ ...p, serviceId: Number(e.target.value), time: '' }))}
                                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                                  <option value={0}>בחר שירות</option>
                                  {services.filter(s => s.active).map(s => (
                                    <option key={s.id} value={s.id}>{s.name} ({s.duration} דק׳)</option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">תאריך</label>
                                <input type="date"
                                  value={editForm.date}
                                  onChange={e => setEditForm(p => ({ ...p, date: e.target.value, time: '' }))}
                                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                              </div>

                              {editForm.date && editForm.serviceId > 0 && (
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 mb-1">שעה</label>
                                  {!editAvailability ? (
                                    <p className="text-gray-400 text-sm">טוען...</p>
                                  ) : editAvailability.nonWorkingDay || editAvailability.dayOff ? (
                                    <p className="text-orange-500 text-sm">
                                      {editAvailability.nonWorkingDay ? 'יום זה אינו יום עבודה' : 'יום זה מסומן כחופשה'}
                                    </p>
                                  ) : editSlots.length === 0 ? (
                                    <p className="text-red-500 text-sm">אין שעות פנויות</p>
                                  ) : (
                                    <div className="grid grid-cols-4 gap-1.5">
                                      {editSlots.map(slot => (
                                        <button key={slot} onClick={() => setEditForm(p => ({ ...p, time: slot }))}
                                          className={`py-2 rounded-lg border text-sm font-medium transition-colors
                                            ${editForm.time === slot
                                              ? 'border-blue-600 bg-blue-600 text-white'
                                              : 'border-gray-200 hover:border-blue-400'}`}>
                                          {slot}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}

                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">הערה פנימית</label>
                                <input type="text" placeholder="הערה..."
                                  value={editForm.note}
                                  onChange={e => setEditForm(p => ({ ...p, note: e.target.value }))}
                                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                              </div>

                              {editError && <p className="text-red-500 text-sm">{editError}</p>}

                              <div className="flex gap-2">
                                <button onClick={() => setEditingApptId(null)}
                                  className="flex-1 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
                                  ביטול
                                </button>
                                <button
                                  disabled={!editForm.name || !editForm.phone || !editForm.serviceId || !editForm.date || !editForm.time || editSaving || !!editPhoneError}
                                  onClick={() => saveEditAppt(a.id)}
                                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-blue-700">
                                  {editSaving ? 'שומר...' : 'שמור שינויים'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Inline cancel confirmation */}
                        {isCancelling && (
                          <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                            <p className="text-sm font-medium text-red-700 mb-2">ביטול התור של {a.name}</p>
                            <input
                              type="text"
                              placeholder="סיבת הביטול (אופציונלי)"
                              value={cancelReason}
                              onChange={e => setCancelReason(e.target.value)}
                              className="w-full text-sm border border-red-200 rounded-lg px-3 py-1.5 mb-2 bg-white"
                            />
                            <div className="flex gap-2">
                              <button onClick={() => setCancellingId(null)}
                                className="flex-1 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
                                חזרה
                              </button>
                              <button onClick={() => confirmCancel(a.id)}
                                className="flex-1 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">
                                אשר ביטול
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Note row — hidden while edit form is open */}
                        {!isEditing && (
                          <div className="mt-2">
                            {isEditingNote ? (
                              <div className="flex gap-2 items-start">
                                <textarea
                                  value={noteText}
                                  onChange={e => setNoteText(e.target.value)}
                                  placeholder="הערה פנימית..."
                                  rows={2}
                                  className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 resize-none"
                                />
                                <div className="flex flex-col gap-1">
                                  <button onClick={() => saveNote(a.id)}
                                    className="text-xs px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                    שמור
                                  </button>
                                  <button onClick={() => setEditingNoteId(null)}
                                    className="text-xs px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50">
                                    ביטול
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setEditingNoteId(a.id); setNoteText(a.note ?? ''); }}
                                className="text-xs text-gray-400 hover:text-blue-600 transition-colors">
                                {a.note
                                  ? <span className="text-gray-600">📝 {a.note}</span>
                                  : '+ הוסף הערה'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* ── SERVICES TAB ── */}
      {tab === 'services' && (
        <div className="grid gap-6">
          {serviceMsg && (
            <div className="bg-green-100 text-green-700 px-4 py-2 rounded-lg text-center font-medium">
              {serviceMsg}
            </div>
          )}

          {/* Add new service */}
          <section className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="font-semibold text-lg mb-4">➕ הוסף שירות</h2>
            <div className="flex flex-wrap gap-2">
              <input type="text" placeholder="שם השירות"
                value={newService.name}
                onChange={e => setNewService(p => ({ ...p, name: e.target.value }))}
                className="flex-1 min-w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <input type="number" placeholder="משך (דק׳)" value={newService.duration} min={5}
                onChange={e => setNewService(p => ({ ...p, duration: Number(e.target.value) }))}
                className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <input type="number" placeholder="מחיר ₪ (אופציונלי)" value={newService.price}
                onChange={e => setNewService(p => ({ ...p, price: e.target.value }))}
                className="w-36 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <button
                disabled={!newService.name || !newService.duration}
                onClick={async () => {
                  const res = await fetch('/api/services', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      name: newService.name,
                      duration: newService.duration,
                      price: newService.price ? Number(newService.price) : null,
                    }),
                  });
                  if (res.ok) {
                    const { id } = await res.json();
                    setServices(prev => [...prev, { id, ...newService, price: newService.price ? Number(newService.price) : null, active: 1, sort_order: prev.length }]);
                    setNewService({ name: '', duration: 30, price: '' });
                    setServiceMsg('נשמר ✓');
                    setTimeout(() => setServiceMsg(''), 2000);
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-blue-700">
                הוסף
              </button>
            </div>
          </section>

          {/* Services list */}
          <section className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="font-semibold text-lg mb-4">רשימת שירותים</h2>
            {services.length === 0 && <p className="text-gray-400 text-sm">אין שירותים</p>}
            <div className="grid gap-3">
              {services.map(s => (
                <div key={s.id} className={`border rounded-lg p-4 ${s.active ? 'border-gray-200' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                  {editingService?.id === s.id ? (
                    <div className="flex flex-wrap gap-2">
                      <input type="text" value={editingService.name}
                        onChange={e => setEditingService(p => p ? { ...p, name: e.target.value } : p)}
                        className="flex-1 min-w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                      <input type="number" value={editingService.duration} min={5}
                        onChange={e => setEditingService(p => p ? { ...p, duration: Number(e.target.value) } : p)}
                        className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                      <input type="number" placeholder="מחיר ₪" value={editingService.price ?? ''}
                        onChange={e => setEditingService(p => p ? { ...p, price: e.target.value ? Number(e.target.value) : null } : p)}
                        className="w-36 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                      <button
                        onClick={async () => {
                          const res = await fetch(`/api/services/${editingService.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(editingService),
                          });
                          if (res.ok) {
                            setServices(prev => prev.map(x => x.id === editingService.id ? editingService : x));
                            setEditingService(null);
                            setServiceMsg('נשמר ✓');
                            setTimeout(() => setServiceMsg(''), 2000);
                          }
                        }}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                        שמור
                      </button>
                      <button onClick={() => setEditingService(null)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
                        ביטול
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{s.name}</span>
                        <span className="text-gray-400 text-sm mr-3">{s.duration} דק׳</span>
                        {s.price != null && <span className="text-gray-500 text-sm">· ₪{s.price}</span>}
                        {!s.active && <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full mr-2">לא פעיל</span>}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            const updated = { ...s, active: s.active ? 0 : 1 };
                            await fetch(`/api/services/${s.id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(updated),
                            });
                            setServices(prev => prev.map(x => x.id === s.id ? updated : x));
                          }}
                          className={`text-sm px-3 py-1 rounded-lg border transition-colors
                            ${s.active
                              ? 'border-orange-200 text-orange-600 hover:bg-orange-50'
                              : 'border-green-200 text-green-600 hover:bg-green-50'}`}>
                          {s.active ? 'השבת' : 'הפעל'}
                        </button>
                        <button onClick={() => setEditingService({ ...s })}
                          className="text-sm px-3 py-1 rounded-lg border border-gray-200 hover:bg-gray-50">
                          עריכה
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
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
                <select value={settings.open_hour}
                  onChange={e => setSettings(p => ({ ...p, open_hour: Number(e.target.value) }))}
                  className="border border-gray-300 rounded-lg px-3 py-2">
                  {HOURS.filter(h => h < settings.close_hour).map(h => (
                    <option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2">
                <span className="text-sm font-medium">סגירה</span>
                <select value={settings.close_hour}
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
                <button key={idx} onClick={() => toggleDay(idx)}
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
              <input type="date" value={newDayOff}
                onChange={e => setNewDayOff(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
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

          {/* Change password */}
          <section className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="font-semibold text-lg mb-4">🔑 שינוי סיסמה</h2>
            <div className="grid gap-3 max-w-sm">
              <div>
                <label className="block text-sm font-medium mb-1">סיסמה נוכחית</label>
                <input type="password" value={pwForm.current}
                  onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">סיסמה חדשה</label>
                <input type="password" value={pwForm.next}
                  onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">אימות סיסמה חדשה</label>
                <input type="password" value={pwForm.confirm}
                  onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              {pwMsg && (
                <p className={`text-sm ${pwMsg.ok ? 'text-green-600' : 'text-red-500'}`}>{pwMsg.text}</p>
              )}
              <button
                disabled={!pwForm.current || !pwForm.next || pwForm.next !== pwForm.confirm}
                onClick={async () => {
                  if (pwForm.next !== pwForm.confirm) {
                    setPwMsg({ text: 'הסיסמאות אינן תואמות', ok: false });
                    return;
                  }
                  const res = await fetch('/api/admin/change-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    setPwMsg({ text: 'הסיסמה שונתה בהצלחה ✓', ok: true });
                    setPwForm({ current: '', next: '', confirm: '' });
                    setTimeout(() => setPwMsg(null), 3000);
                  } else {
                    setPwMsg({ text: data.error || 'שגיאה בשינוי הסיסמה', ok: false });
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-blue-700">
                עדכן סיסמה
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
