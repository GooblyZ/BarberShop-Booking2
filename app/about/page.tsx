import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'אודות | מספרת פלורנטין',
  description: 'למה לבחור במספרת פלורנטין? מקצועיות, אווירה חמה וגמישות מלאה.',
};

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  );
}
function CoffeeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.5 3H6c-1.1 0-2 .9-2 2v5.71c0 3.83 2.95 7.18 6.78 7.29 3.96.12 7.22-3.06 7.22-7V5c0-1.1-.9-2-2-2zM16 10c0 2.21-1.79 4-4 4s-4-1.79-4-4V5h8v5zM4 19h16v2H4v-2z"/>
    </svg>
  );
}
function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/>
    </svg>
  );
}

const reasons = [
  {
    Icon: StarIcon,
    title: 'מקצועיות ללא פשרות',
    text: 'ספרים מנוסים עם הכשרה מקצועית גבוהה ועין אסתטית מפותחת לכל סגנון וסוג שיער.',
  },
  {
    Icon: CoffeeIcon,
    title: 'אווירה חמה ומקבלת',
    text: 'אצלנו מרגישים בבית — שיחה נעימה, קפה חם, ותחושה של שכונה אמיתית ואנושית.',
  },
  {
    Icon: ClockIcon,
    title: 'גמישות ונוחות מלאה',
    text: 'הזמינו תור בקלות מהטלפון בכל שעה — ללא שיחות טלפון, ללא המתנה מיותרת.',
  },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-cream pt-20 pb-24 relative overflow-hidden">
      {/* Back link */}
      <div className="max-w-5xl mx-auto px-5 mb-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-brown-mid hover:text-terra-light transition-colors font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          חזרה לדף הבית
        </Link>
      </div>

      {/* Header */}
      <div className="text-center mb-16 px-5">
        <span className="text-terra text-xs font-bold uppercase tracking-[0.18em]">למה לבחור בנו</span>
        <h1 className="font-serif font-black text-4xl md:text-5xl text-brown mt-2">
          הסיבות שיגרמו לכם לחזור
        </h1>
        <p className="text-brown-mid max-w-lg mx-auto mt-4 text-base leading-relaxed">
          מספרת פלורנטין היא הרבה יותר מסתם תספורת — זו חוויה שכונתית אמיתית.
        </p>
      </div>

      {/* Cards */}
      <div className="max-w-5xl mx-auto px-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
          {reasons.map(({ Icon, title, text }) => (
            <div
              key={title}
              className="card-glass rounded-3xl p-8 text-center"
            >
              <div className="w-14 h-14 bg-terra/10 rounded-2xl flex items-center justify-center mx-auto mb-5 text-terra">
                <Icon className="w-7 h-7" />
              </div>
              <h2 className="font-serif font-bold text-xl text-brown mb-3">{title}</h2>
              <p className="text-brown-mid text-sm leading-relaxed">{text}</p>
            </div>
          ))}
        </div>

        {/* About story */}
        <div
          className="mt-16 rounded-3xl p-8 md:p-12"
          style={{
            background: 'linear-gradient(145deg, rgba(40,30,22,0.96) 0%, rgba(24,17,12,0.99) 100%)',
            border: '1px solid rgba(149,18,44,0.22)',
          }}
        >
          <div className="max-w-2xl mx-auto text-center">
            <span className="text-terra text-[10px] font-bold uppercase tracking-[0.22em] block mb-4">הסיפור שלנו</span>
            <h2 className="font-serif font-black text-2xl md:text-3xl text-brown mb-6 leading-snug">
              מספרת פלורנטין — יותר מסתם תספורת
            </h2>
            <p className="text-brown-mid text-sm leading-relaxed mb-5">
              אנחנו מספרה שכונתית בלב תל אביב, עם למעלה מ-7 שנות ניסיון בענף. אצלנו כל לקוח מקבל יחס
              אישי, תשומת לב לפרטים הקטנים ביותר, ותוצאה שתגרום לכם לחייך בפעם הבאה שתסתכלו במראה.
            </p>
            <p className="text-brown-mid text-sm leading-relaxed mb-8">
              אנחנו מקפידים על ניקיון ותברואה ברמה הגבוהה ביותר, על דיוק בזמנים ועל
              אווירה נעימה שתרגישו בה בנוח — בין אם זו הפעם הראשונה שלכם אצלנו ובין אם אתם לקוחות ותיקים.
              מערכת ההזמנות המקוונת שלנו מאפשרת לכם לקבוע תור בקלות, בכל שעה, ללא שיחות טלפון.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              {[
                { icon: '✂️', label: 'תספורת מקצועית' },
                { icon: '🧼', label: 'ניקיון ותברואה' },
                { icon: '⏱️', label: 'דיוק בזמנים'    },
                { icon: '💬', label: 'יחס אישי'        },
              ].map(({ icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-2 p-3 rounded-2xl"
                  style={{ background: 'rgba(149,18,44,0.07)', border: '1px solid rgba(149,18,44,0.14)' }}>
                  <span className="text-2xl">{icon}</span>
                  <span className="text-brown-mid text-xs font-medium text-center leading-tight">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <Link
            href="/#booking"
            className="btn-crimson text-white px-10 py-4 rounded-full text-lg font-bold inline-block"
          >
            הזמינו תור עכשיו
          </Link>
        </div>
      </div>
    </main>
  );
}
