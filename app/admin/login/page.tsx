'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSetupError = searchParams.get('setup') === '1';

  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.push('/admin');
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || 'שגיאת התחברות');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-2">מספרה — כניסת מנהל</h1>
        <p className="text-center text-gray-500 text-sm mb-8">הכניסה מוגבלת לצוות בלבד</p>

        {isSetupError && (
          <div className="bg-red-50 border border-red-300 rounded-lg p-4 mb-6 text-sm text-red-700">
            <strong>שגיאת הגדרה:</strong> משתנה הסביבה <code className="bg-red-100 px-1 rounded">ADMIN_PASSWORD</code> לא מוגדר.
            <br />יש להוסיף אותו לקובץ <code className="bg-red-100 px-1 rounded">.env.local</code> ולהפעיל מחדש את השרת.
          </div>
        )}

        <form onSubmit={handleLogin} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <label className="block mb-1 font-medium text-sm">סיסמת מנהל</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="הכניסו סיסמה"
            autoFocus
            className="w-full border border-gray-300 rounded-lg p-3 mb-4 text-base"
          />
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <button
            type="submit"
            disabled={!password || loading}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold disabled:opacity-40 hover:bg-blue-700">
            {loading ? 'מתחבר...' : 'כניסה'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a href="/" className="text-sm text-gray-400 hover:text-gray-600">← חזרה לאתר</a>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
