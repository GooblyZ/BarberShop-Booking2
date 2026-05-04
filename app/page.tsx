'use client';

import { useState, useEffect } from 'react';
import { SERVICES, generateSlots, timeToMinutes, hasOverlap, isValidIsraeliPhone } from '@/lib/services';
import type { Appointment } from '@/app/api/appointments/route';
import type { BlockedRange } from '@/app/api/blocked-ranges/route';
import type { Settings } from '@/app/api/settings/route';

type Step = 'service' | 'datetime' | 'details' | 'done';

interface Availability {
  settings:       Settings;
  nonWorkingDay:  boolean;
  dayOff:         boolean;
  booked:         Appointment[];
  blockedRanges:  BlockedRange[];
}

export default function BookingPage() {
  const [step, setStep]             = useState<Step>('service');
  const [serviceId, setServiceId]   = useState('');
  const [date, setDate]             = useState('');
  const [time, setTime]             = useState('');
  const [name, setName]             = useState('');
  const [phone, setPhone]           = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);

  const service = SERVICES.find(s => s.id === serviceId);
  const today   = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!date) { setAvailability(null); return; }
    fetch(`/api/availability?date=${date}`)
      .then(r => r.json())
      .then(setAvailability);
  }, [date]);

  // Compute available time slots from availability data
  const availableSlots: string[] = (() => {
    if (!service || !availability) return [];
    const { settings, nonWorkingDay, dayOff, booked, blockedRanges } = availability;
    if (nonWorkingDay || dayOff) return [];

    const closeMins = settings.close_hour * 60;

    return generateSlots(settings.open_hour, settings.close_hour).filter(slot => {
      const start = timeToMinutes(slot);
      const end   = start + service.duration;
      if (end > closeMins) return false;

      if (date === today) {
        const now     = new Date();
        const nowMins = now.getHours() * 60 + now.getMinutes();
        if (start <= nowMins) return false;
      }

      if (blockedRanges.some(r => {
        const rStart    = timeToMinutes(r.start_time);
        const rDuration = timeToMinutes(r.end_time) - rStart;
        return hasOverlap(start, service.duration, rStart, rDuration);
      })) return false;

      return !booked.some(b =>
        hasOverlap(start, service.duration, timeToMinutes(b.time), b.duration)
      );
    });
  })();

  function handlePhoneChange(val: string) {
    const digits = val.replace(/\D/g, '').slice(0, 10);
    setPhone(digits);
    if (digits.length > 0 && !isValidIsraeliPhone(digits)) {
      setPhoneError('מספר טלפון לא תקין (לדוגמה: 0501234567)');
    } else {
      setPhoneError('');
    }
  }

  async function handleSubmit() {
    if (!isValidIsraeliPhone(phone)) {
      setPhoneError('מספר טלפון לא תקין (לדוגמה: 0501234567)');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, serviceId, date, time }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'שגיאה בהזמנה');
      } else {
        setStep('done');
      }
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep('service'); setServiceId(''); setDate(''); setTime('');
    setName(''); setPhone(''); setPhoneError(''); setError(''); setAvailability(null);
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-center mb-2">✂️ מספרה</h1>
      <p className="text-center text-gray-500 mb-8">הזמינו תור בקלות</p>

      {step !== 'done' && (
        <div className="flex gap-2 mb-8 justify-center text-sm">
          {(['service', 'datetime', 'details'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs
                ${step === s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {i + 1}
              </span>
              <span className={step === s ? 'font-semibold' : 'text-gray-400'}>
                {s === 'service' ? 'שירות' : s === 'datetime' ? 'מועד' : 'פרטים'}
              </span>
              {i < 2 && <span className="text-gray-300 mx-1">›</span>}
            </div>
          ))}
        </div>
      )}

      {/* Step 1 — Service */}
      {step === 'service' && (
        <div>
          <h2 className="text-xl font-semibold mb-4">בחרו שירות</h2>
          <div className="grid gap-3">
            {SERVICES.map(s => (
              <button
                key={s.id}
                onClick={() => { setServiceId(s.id); setStep('datetime'); }}
                className="w-full text-right border-2 border-gray-200 rounded-xl p-4 hover:border-blue-500 hover:bg-blue-50 transition-colors"
              >
                <div className="font-semibold text-lg">{s.name}</div>
                <div className="text-gray-500 text-sm">{s.duration} דקות</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2 — Date & Time */}
      {step === 'datetime' && (
        <div>
          <h2 className="text-xl font-semibold mb-4">בחרו תאריך ושעה</h2>

          <label className="block mb-1 font-medium">תאריך</label>
          <input
            type="date"
            min={today}
            value={date}
            onChange={e => { setDate(e.target.value); setTime(''); }}
            className="w-full border border-gray-300 rounded-lg p-3 mb-6 text-base"
          />

          {date && availability && (
            <>
              {availability.nonWorkingDay && (
                <p className="text-orange-500 mb-4">📅 יום זה אינו יום עבודה</p>
              )}
              {availability.dayOff && (
                <p className="text-orange-500 mb-4">🚫 יום זה מסומן כחופשה</p>
              )}
              {!availability.nonWorkingDay && !availability.dayOff && (
                <>
                  <label className="block mb-2 font-medium">שעה פנויה</label>
                  {availableSlots.length === 0 ? (
                    <p className="text-red-500">אין שעות פנויות בתאריך זה</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {availableSlots.map(slot => (
                        <button
                          key={slot}
                          onClick={() => setTime(slot)}
                          className={`py-3 rounded-lg border-2 font-medium transition-colors
                            ${time === slot
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-gray-200 hover:border-blue-400'}`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {date && !availability && (
            <p className="text-gray-400 text-sm">טוען...</p>
          )}

          <div className="flex gap-3 mt-6">
            <button onClick={() => setStep('service')}
              className="flex-1 py-3 border border-gray-300 rounded-lg hover:bg-gray-100">
              חזרה
            </button>
            <button
              onClick={() => setStep('details')}
              disabled={!date || !time}
              className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-semibold disabled:opacity-40 hover:bg-blue-700">
              המשך
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Personal details */}
      {step === 'details' && (
        <div>
          <h2 className="text-xl font-semibold mb-4">הפרטים שלכם</h2>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6 text-sm">
            <div><span className="font-medium">שירות: </span>{service?.name}</div>
            <div><span className="font-medium">תאריך: </span>{date} בשעה {time}</div>
          </div>

          <label className="block mb-1 font-medium">שם מלא</label>
          <input
            type="text"
            placeholder="ישראל ישראלי"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-3 mb-4 text-base"
          />

          <label className="block mb-1 font-medium">טלפון</label>
          <input
            type="tel"
            placeholder="0501234567"
            value={phone}
            onChange={e => handlePhoneChange(e.target.value)}
            maxLength={10}
            className={`w-full border rounded-lg p-3 mb-1 text-base
              ${phoneError ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
          />
          {phoneError && (
            <p className="text-red-500 text-sm mb-4">{phoneError}</p>
          )}
          {!phoneError && <div className="mb-4" />}

          {error && <p className="text-red-500 mb-4">{error}</p>}

          <div className="flex gap-3">
            <button onClick={() => setStep('datetime')}
              className="flex-1 py-3 border border-gray-300 rounded-lg hover:bg-gray-100">
              חזרה
            </button>
            <button
              onClick={handleSubmit}
              disabled={!name || !phone || !!phoneError || loading}
              className="flex-1 py-3 bg-green-600 text-white rounded-lg font-semibold disabled:opacity-40 hover:bg-green-700">
              {loading ? 'שולח...' : 'אשרו תור'}
            </button>
          </div>
        </div>
      )}

      {/* Done */}
      {step === 'done' && (
        <div className="text-center py-8">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold mb-2">התור נקבע בהצלחה!</h2>
          <p className="text-gray-600 mb-1">{service?.name}</p>
          <p className="text-gray-600 mb-6">{date} בשעה {time}</p>
          <button onClick={reset}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">
            הזמינו תור נוסף
          </button>
        </div>
      )}

      <div className="mt-12 text-center">
        <a href="/admin" className="text-xs text-gray-300 hover:text-gray-400">ניהול</a>
      </div>
    </main>
  );
}
