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

export default function AppointmentStatusPage() {
  const { token } = useParams<{ token: string }>();
  const [appt, setAppt]       = useState<PublicAppointment | null>(null);
  const [loading, setLoading] = useState(true);
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
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400">טוען...</p>
      </main>
    );
  }

  if (notFound || !appt) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <div className="text-5xl mb-4">🔍</div>
          <h1 className="text-xl font-bold mb-2">תור לא נמצא</h1>
          <p className="text-gray-500 text-sm mb-6">הקישור אינו תקין או שהתור הוסר</p>
          <a href="/" className="text-blue-600 hover:underline text-sm">חזרה לדף הבית</a>
        </div>
      </main>
    );
  }

  const isConfirmed  = appt.status === 'confirmed';
  const isCancelledAdmin = appt.status === 'cancelled_by_admin';
  const isCancelledCustomer = appt.status === 'cancelled_by_customer';
  const isCancelled  = isCancelledAdmin || isCancelledCustomer;
  const isCompleted  = appt.status === 'completed';

  return (
    <main className="max-w-md mx-auto px-4 py-10" dir="rtl">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-1">✂️ מספרה</h1>
        <p className="text-gray-500 text-sm">סטטוס התור שלך</p>
      </div>

      {/* Status banner */}
      {isConfirmed && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-center">
          <div className="text-3xl mb-1">✅</div>
          <p className="font-bold text-blue-800 text-lg">התור מאושר</p>
          <p className="text-blue-600 text-sm">נתראה בקרוב!</p>
        </div>
      )}

      {isCancelledAdmin && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 mb-6 text-center">
          <div className="text-3xl mb-1">❌</div>
          <p className="font-bold text-red-700 text-lg">התור שלך בוטל</p>
          <p className="text-red-500 text-sm mt-1">התור בוטל על ידי העסק</p>
          {appt.cancel_reason && (
            <div className="mt-3 bg-red-100 rounded-lg p-3 text-sm text-red-700">
              <span className="font-medium">סיבת הביטול: </span>{appt.cancel_reason}
            </div>
          )}
          <div className="mt-4">
            <a href="/" className="inline-block px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
              הזמינו תור חדש
            </a>
          </div>
        </div>
      )}

      {isCancelledCustomer && (
        <div className="bg-gray-100 border border-gray-200 rounded-xl p-4 mb-6 text-center">
          <div className="text-3xl mb-1">🚫</div>
          <p className="font-bold text-gray-700 text-lg">ביטלת את התור</p>
          <div className="mt-4">
            <a href="/" className="inline-block px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              הזמינו תור חדש
            </a>
          </div>
        </div>
      )}

      {isCompleted && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-center">
          <div className="text-3xl mb-1">⭐</div>
          <p className="font-bold text-green-800 text-lg">התור הושלם</p>
          <p className="text-green-600 text-sm mt-1">תודה שביקרת אצלנו!</p>
          <div className="mt-4">
            <a href="/" className="inline-block px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
              הזמינו תור נוסף
            </a>
          </div>
        </div>
      )}

      {/* Appointment details */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mb-6">
        <p className="text-xs text-gray-400 font-medium mb-3 uppercase tracking-wide">פרטי התור</p>
        <div className="grid gap-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">שם</span>
            <span className="font-medium">{appt.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">שירות</span>
            <span className="font-medium">{appt.service}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">משך</span>
            <span>{appt.duration} דקות</span>
          </div>
          <div className="flex justify-between items-start">
            <span className="text-gray-500">תאריך</span>
            <span className="font-medium text-left">{formatDateHe(appt.date)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">שעה</span>
            <span className="font-bold text-blue-700 text-base">{appt.time}</span>
          </div>
        </div>
      </div>

      {/* Customer cancel */}
      {isConfirmed && (
        <div className="text-center">
          {!confirmOpen ? (
            <button onClick={() => setConfirmOpen(true)}
              className="text-sm text-gray-400 hover:text-red-500 transition-colors underline">
              ביטול התור
            </button>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="font-medium text-red-700 mb-3">האם לבטל את התור?</p>
              <p className="text-sm text-red-500 mb-4">לא ניתן לבטל פעולה זו</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmOpen(false)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
                  חזרה
                </button>
                <button onClick={handleCancel} disabled={cancelling}
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                  {cancelling ? 'מבטל...' : 'אשר ביטול'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-10 text-center">
        <a href="/" className="text-xs text-gray-300 hover:text-gray-500">← חזרה לדף הבית</a>
      </div>
    </main>
  );
}
