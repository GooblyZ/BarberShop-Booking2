import type { Metadata } from 'next';
import { Heebo, Frank_Ruhl_Libre } from 'next/font/google';
import './globals.css';
import CustomCursor from './components/CustomCursor';

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  variable: '--font-heebo',
  display: 'swap',
});

const frank = Frank_Ruhl_Libre({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '700', '900'],
  variable: '--font-frank',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'מספרת פלורנטין — תספורת וסטייל',
  description: 'מספרה שכונתית עם ניסיון של שנים. שירות אישי, אווירה חמה. הזמינו תור בקלות.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${frank.variable}`}>
      <body className="min-h-screen bg-cream text-brown antialiased font-sans">
        <CustomCursor />
        {children}
      </body>
    </html>
  );
}
