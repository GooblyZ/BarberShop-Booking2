'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface PublicAppointment {
  name: string;
  service: string;
  date: string;
  time: string;
  duration: number;
  status: string;
  cancel_reason: string | null;
}

function formatDateHe(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('he-IL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function ScissorsIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="3"/>
      <circle cx="6" cy="18" r="3"/>
      <line x1="20" y1="4" x2="8.12" y2="15.88"/>
      <line x1="14.47" y1="14.48" x2="20" y2="20"/>
      <line x1="8.12" y1="8.12" x2="12" y2="12"/>
    </svg>
  );
}

export default function AppointmentStatusPage() {
  const { token } = useParams<{ token: string }>();
  const [appt, setAppt]         = useState<PublicAppointment | null>(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/appointment/${token}`)
      .then(r => { if (r.status === 404) { setNotFound(true); return null; } return r.json(); })
      .then(data => { if (data) setAppt(data); })
      .finally(() => setLoading(false));
  }, [token]);

  async function handleCancel() {
    setCancelling(true);
    const res = await fetch(`/api/appointment/${token}/cancel`, { method: 'POST' });
    if (res.ok) {
      setAppt(prev => prev ? { ...prev, status: 'cancelled_by_customer' } : prev);
    }
    setCancelling(false);
    setConfirmOpen(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-cream">
        <p className="text-brown-mid">טוען...</p>
      </main>
    );
  }

  if (notFound || !appt) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-cream px-4" dir="rtl">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-sand border border-border
            flex items-center justify-center">
            <svg className="w-7 h-7 text-brown-mid" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803M10.5 7.5v6m3-3h-6" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-brown mb-2">תור לא נמצא</h1>
          <p className="text-brown-mid text-sm mb-6">הקישור אינו תקין או שהתור הוסר</p>
          <a href="/" className="text-terra hover:text-terra-light text-sm transition-colors">
            ← חזרה לדף הבית
          </a>
        </div>
      </main>
    );
  }

  const isConfirmed        = appt.status === 'confirmed';
  const isCancelledAdmin   = appt.status === 'cancelled_by_admin';
  const isCancelledCustomer = appt.status === 'cancelled_by_customer';
  const isCompleted        = appt.status === 'completed';

  return (
    <main className="min-h-screen bg-cream py-12 px-4" dir="rtl">
      <div className="max-w-md mx-auto">

        {/* Brand header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <ScissorsIcon className="w-6 h-6 text-terra" />
            <span className="font-serif text-2xl text-brown tracking-wide">פלורנטין</span>
          </div>
          <p className="text-brown-light text-xs tracking-widest uppercase">סטטוס התור שלך</p>
        </div>

        {/* ── Status banner: confirmed ── */}
        {isConfirmed && (
          <div className="rounded-2xl p-5 mb-6 text-center border"
            style={{ background: 'rgba(149,18,44,0.10)', borderColor: 'rgba(149,18,44,0.28)' }}>
            <div className="w-10 h-10 mx-auto mb-3 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(149,18,44,0.18)' }}>
              <svg className="w-5 h-5 text-terra-light" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <p className="font-bold text-brown text-lg">התור מאושר</p>
            <p className="text-brown-mid text-sm mt-1">נתראה בקרוב!</p>
          </div>
        )}

        {/* ── Status banner: cancelled by admin ── */}
        {isCancelledAdmin && (
          <div className="rounded-2xl p-5 mb-6 text-center border"
            style={{ background: 'rgba(30,23,18,0.95)', borderColor: 'rgba(149,18,44,0.35)' }}>
            <div className="w-10 h-10 mx-auto mb-3 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(149,18,44,0.15)' }}>
              <svg className="w-5 h-5 text-terra-light" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="font-bold text-brown text-lg">התור שלך בוטל</p>
            <p className="text-brown-mid text-sm mt-1">התור בוטל על ידי העסק</p>
            {appt.cancel_reason && (
              <div className="mt-3 rounded-xl p-3 text-sm text-brown-mid"
                style={{ background: 'rgba(46,34,24,0.6)' }}>
                <span className="font-medium text-brown">סיבת הביטול: </span>
                {appt.cancel_reason}
              </div>
            )}
            <div className="mt-5">
              <a href="/"
                className="btn-crimson inline-block px-6 py-2.5 rounded-full text-white text-sm font-medium">
                הזמינו תור חדש
              </a>
            </div>
          </div>
        )}

        {/* ── Status banner: cancelled by customer ── */}
        {isCancelledCustomer && (
          <div className="rounded-2xl p-5 mb-6 text-center border"
            style={{ background: 'rgba(30,23,18,0.95)', borderColor: 'rgba(46,34,24,0.8)' }}>
            <div className="w-10 h-10 mx-auto mb-3 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(94,78,68,0.25)' }}>
              <svg className="w-5 h-5 text-brown-mid" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <p className="font-bold text-brown text-lg">ביטלת את התור</p>
            <div className="mt-5">
              <a href="/"
                className="btn-crimson inline-block px-6 py-2.5 rounded-full text-white text-sm font-medium">
                הזמינו תור חדש
              </a>
            </div>
          </div>
        )}

        {/* ── Status banner: completed ── */}
        {isCompleted && (
          <div className="rounded-2xl p-5 mb-6 text-center border"
            style={{ background: 'rgba(30,23,18,0.95)', borderColor: 'rgba(201,169,110,0.28)' }}>
            <div className="w-10 h-10 mx-auto mb-3 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(201,169,110,0.15)' }}>
              <svg className="w-5 h-5 text-amber" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </div>
            <p className="font-bold text-brown text-lg">התור הושלם</p>
            <p className="text-brown-mid text-sm mt-1">תודה שביקרת אצלנו!</p>
            <div className="mt-5">
              <a href="/"
                className="btn-crimson inline-block px-6 py-2.5 rounded-full text-white text-sm font-medium">
                הזמינו תור נוסף
              </a>
            </div>
          </div>
        )}

        {/* Appointment details */}
        <div className="bg-sand border border-border rounded-2xl p-5 mb-6">
          <p className="text-xs text-brown-light font-medium mb-4 uppercase tracking-widest">
            פרטי התור
          </p>
          <div className="grid gap-0 text-sm divide-y divide-border/40">
            <div className="flex justify-between items-center py-3">
              <span className="text-brown-mid">שם</span>
              <span className="font-medium text-brown">{appt.name}</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-brown-mid">שירות</span>
              <span className="font-medium text-brown">{appt.service}</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-brown-mid">משך</span>
              <span className="text-brown">{appt.duration} דקות</span>
            </div>
            <div className="flex justify-between items-start py-3">
              <span className="text-brown-mid shrink-0 ml-4">תאריך</span>
              <span className="font-medium text-brown text-left">{formatDateHe(appt.date)}</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-brown-mid">שעה</span>
              <span className="font-bold text-terra-light text-lg tracking-wider">{appt.time}</span>
            </div>
          </div>
        </div>

        {/* Customer cancel */}
        {isConfirmed && (
          <div className="text-center">
            {!confirmOpen ? (
              <button
                onClick={() => setConfirmOpen(true)}
                className="text-sm text-brown-light hover:text-terra transition-colors underline underline-offset-2">
                ביטול התור
              </button>
            ) : (
              <div className="rounded-2xl p-5 border"
                style={{ background: 'rgba(30,23,18,0.97)', borderColor: 'rgba(149,18,44,0.30)' }}>
                <p className="font-medium text-brown mb-2">האם לבטל את התור?</p>
                <p className="text-sm text-brown-mid mb-5">לא ניתן לבטל פעולה זו</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmOpen(false)}
                    className="flex-1 py-2.5 border border-border rounded-xl text-sm
                      text-brown-mid hover:border-brown-mid/40 transition-colors">
                    חזרה
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="btn-crimson flex-1 py-2.5 text-white rounded-xl text-sm font-medium">
                    {cancelling ? 'מבטל...' : 'אשר ביטול'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-12 text-center">
          <a href="/" className="text-xs text-brown-light hover:text-terra transition-colors">
            ← חזרה לדף הבית
          </a>
        </div>

      </div>
    </main>
  );
}
