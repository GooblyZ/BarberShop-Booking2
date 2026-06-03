'use client';

import { useState, useEffect, useRef } from 'react';
import ScrollVideoHero from '@/app/components/ScrollVideoHero';
import { isValidIsraeliPhone } from '@/lib/services';
import type { Service } from '@/lib/services';

/* ─── Fallback services ────────────────────────────────────────────────────
   Used when the API is unavailable (e.g. serverless env without SQLite).
   Real DB data takes priority — fallback only kicks in on error/empty.     */
const FALLBACK_SERVICES: Service[] = [
  { id: 1, name: 'תספורת גברית',  duration: 30, price: 80,  active: 1, sort_order: 0 },
  { id: 2, name: 'עיצוב זקן',      duration: 20, price: 50,  active: 1, sort_order: 1 },
  { id: 3, name: 'תספורת + זקן',   duration: 45, price: 120, active: 1, sort_order: 2 },
  { id: 4, name: 'תספורת ילד',     duration: 25, price: 60,  active: 1, sort_order: 3 },
];

type Step = 'service' | 'datetime' | 'details' | 'done';

/* ─── Scissors SVG ─────────────────────────────────────────────────────── */
function ScissorsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8c-1.1 0-2-.89-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm0 12c-1.1 0-2-.89-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm6-7.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5.5.22.5.5-.22.5-.5.5zM19 3l-6 6 2 2 7-7V3z"/>
    </svg>
  );
}

/* ─── Additional icons ──────────────────────────────────────────────────── */
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

/* ─── Scroll-reveal hook ────────────────────────────────────────────────── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('visible'); obs.disconnect(); } },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

/* ─── Animated counter ─────────────────────────────────────────────────── */
function AnimCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      obs.disconnect();
      const dur = 1200;
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min((now - start) / dur, 1);
        setVal(Math.round(t * target));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [target]);
  return <span ref={ref}>{val.toLocaleString('he-IL')}{suffix}</span>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════════════ */
export default function HomePage() {
  /* ── Shared state ───────────────────────────────────────────────────── */
  const [services,     setServices]     = useState<Service[]>([]);
  const [servicesFetched, setServicesFetched] = useState(false);
  const [scrolled,  setScrolled]  = useState(false);
  const [menuOpen,  setMenuOpen]  = useState(false);
  const bookingRef = useRef<HTMLElement>(null);

  /* ── Booking state ──────────────────────────────────────────────────── */
  const [step,         setStep]         = useState<Step>('service');
  const [serviceId,    setServiceId]    = useState<number | null>(null);
  const [date,         setDate]         = useState('');
  const [time,         setTime]         = useState('');
  const [name,         setName]         = useState('');
  const [phone,        setPhone]        = useState('');
  const [phoneError,   setPhoneError]   = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[] | null>(null);
  const [availabilityError, setAvailabilityError] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [loading,      setLoading]      = useState(false);
  const [bookingToken, setBookingToken] = useState('');
  const [linkCopied,   setLinkCopied]   = useState(false);
  const [inBookingView, setInBookingView] = useState(false);

  const service = services.find(s => s.id === serviceId);
  const today   = new Date().toISOString().split('T')[0];

  /* ── Data fetching ──────────────────────────────────────────────────── */
  useEffect(() => {
    fetch('/api/services?active=1')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: Service[]) => {
        setServices(Array.isArray(data) && data.length > 0 ? data : FALLBACK_SERVICES);
      })
      .catch(() => {
        // API unavailable (e.g. serverless without SQLite) — fall back to demo list
        setServices(FALLBACK_SERVICES);
      })
      .finally(() => setServicesFetched(true));
  }, []);

  useEffect(() => {
    let ticking = false;
    const handler = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setScrolled(window.scrollY > 60);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => {
    if (!date || !service) {
      setAvailableSlots(null);
      setAvailabilityError(false);
      return;
    }
    const ctrl = new AbortController();
    setAvailableSlots(null);
    setAvailabilityError(false);
    fetch(`/api/availability?date=${date}&duration=${service.duration}`, { signal: ctrl.signal })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: { slots: string[] }) => {
        if (!Array.isArray(data.slots)) throw new Error('unexpected response shape');
        setAvailableSlots(data.slots);
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        console.error('[availability] fetch failed:', err);
        setAvailabilityError(true);
      });
    return () => ctrl.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, service?.id]);

  useEffect(() => {
    const el = bookingRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => setInBookingView(e.isIntersecting),
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);


  /* ── Handlers ───────────────────────────────────────────────────────── */
  function handlePhoneChange(val: string) {
    const digits = val.replace(/\D/g, '').slice(0, 10);
    setPhone(digits);
    setPhoneError(digits.length > 0 && !isValidIsraeliPhone(digits)
      ? 'מספר טלפון לא תקין (לדוגמה: 0501234567)' : '');
  }

  async function handleSubmit() {
    if (!isValidIsraeliPhone(phone)) {
      setPhoneError('מספר טלפון לא תקין (לדוגמה: 0501234567)');
      return;
    }
    setBookingError('');
    setLoading(true);
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, serviceId, date, time }),
      });
      if (!res.ok) {
        const data = await res.json();
        setBookingError(data.error || 'שגיאה בהזמנה');
      } else {
        const data = await res.json();
        setBookingToken(data.token ?? '');
        setStep('done');
      }
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep('service'); setServiceId(null); setDate(''); setTime('');
    setName(''); setPhone(''); setPhoneError(''); setBookingError('');
    setAvailableSlots(null); setAvailabilityError(false); setBookingToken(''); setLinkCopied(false);
  }

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/appointment/${bookingToken}`)
      .then(() => { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2500); });
  }

  function scrollToBooking(initialServiceId?: number) {
    if (initialServiceId != null) {
      setServiceId(initialServiceId);
      setStep('datetime');
      setDate(''); setTime('');
      setAvailableSlots(null); setAvailabilityError(false); setBookingError(''); setPhoneError('');
    }
    setTimeout(() => bookingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
    setMenuOpen(false);
  }

  /* ── Section reveal refs ────────────────────────────────────────────── */
  const statsRef       = useReveal();
  const servicesRef    = useReveal();
  const ctaRef         = useReveal();
  const bookHeadRef    = useReveal();
  const servicesGridRef = useRef<HTMLDivElement>(null);

  // Stagger-reveal the service cards once they scroll into view
  useEffect(() => {
    if (services.length === 0) return;
    const el = servicesGridRef.current;
    if (!el) return;
    const items = el.querySelectorAll<HTMLElement>('[data-stagger]');
    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      items.forEach((item, i) => {
        setTimeout(() => {
          item.style.opacity   = '1';
          item.style.transform = 'none';
        }, i * 95);
      });
      obs.disconnect();
    }, { threshold: 0.08 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [services]);

  /* ════════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════ */
  return (
    <>
      {/* ─────────────────────────── HEADER ─────────────────────────── */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-cream/95 backdrop-blur-md border-b border-sand/40 shadow-[0_2px_24px_rgba(0,0,0,0.55)]'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          {/* Logo */}
          <a href="#hero" className="flex items-center gap-2 group">
            <span
              className="w-8 h-8 bg-terra rounded-lg flex items-center justify-center"
              style={{ boxShadow: '0 0 14px rgba(149,18,44,0.45)' }}
            >
              <ScissorsIcon className="w-4 h-4 text-white" />
            </span>
            <span className="font-serif font-black text-xl text-brown group-hover:text-terra transition-colors">
              פלורנטין
            </span>
          </a>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            <a href="#services" className="text-brown-mid hover:text-brown transition-colors">שירותים</a>
            <a href="/about"    className="text-brown-mid hover:text-brown transition-colors">אודות</a>
            <a href="#booking"  className="text-brown-mid hover:text-brown transition-colors">הזמנת תור</a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => scrollToBooking()}
              className="btn-crimson text-white px-5 py-2.5 rounded-full text-sm font-semibold"
            >
              הזמינו תור
            </button>
            {/* Mobile menu toggle */}
            <button
              className="md:hidden p-2 text-brown-mid hover:text-brown transition-colors"
              onClick={() => setMenuOpen(v => !v)}
              aria-label="תפריט"
            >
              <span className="block w-5 h-0.5 bg-current mb-1 transition-all" style={menuOpen ? {transform:'rotate(45deg) translate(3px,3px)'} : {}} />
              <span className="block w-5 h-0.5 bg-current mb-1 transition-all" style={menuOpen ? {opacity:0} : {}} />
              <span className="block w-5 h-0.5 bg-current transition-all" style={menuOpen ? {transform:'rotate(-45deg) translate(3px,-3px)'} : {}} />
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div
            className="md:hidden border-t border-sand/30 px-5 py-4 flex flex-col gap-4 text-sm font-medium"
            style={{ background: 'rgba(16,12,8,0.97)', backdropFilter: 'blur(12px)' }}
          >
            <a href="#services" onClick={() => setMenuOpen(false)} className="text-brown-mid hover:text-brown transition-colors">שירותים</a>
            <a href="/about"    onClick={() => setMenuOpen(false)} className="text-brown-mid hover:text-brown transition-colors">אודות</a>
            <a href="#booking"  onClick={() => setMenuOpen(false)} className="text-brown-mid hover:text-brown transition-colors">הזמנת תור</a>
          </div>
        )}
      </header>

      {/* ─────────────────────────── SCROLL VIDEO HERO ──────────────── */}
      <ScrollVideoHero />

      {/* ──────────────────────── SOCIAL PROOF BAND ─────────────────── */}
      <section
        ref={statsRef}
        className="reveal bg-sand"
        style={{ borderTop: '1px solid rgba(149,18,44,0.14)', borderBottom: '1px solid rgba(149,18,44,0.10)' }}
      >
        <div className="max-w-4xl mx-auto px-5 py-10">
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { target: 500, suffix: '+', label: 'לקוחות מרוצים' },
              { target: 7,   suffix: '+', label: 'שנות ניסיון'    },
              { target: 4,   suffix: '',  label: 'דירוג ממוצע',  star: true },
            ].map(({ target, suffix, label, star }) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-serif font-black text-2xl sm:text-3xl text-brown">
                    <AnimCounter target={target} suffix={star ? '' : suffix} />
                    {star && <span>.9</span>}
                  </span>
                  {star && <StarIcon className="w-5 h-5 text-amber flex-shrink-0" />}
                </div>
                <p className="text-brown-light text-[10px] sm:text-xs uppercase tracking-widest leading-tight">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────────────── SERVICES SECTION ────────────────────── */}
      <section id="services" className="py-28 bg-cream relative overflow-hidden">

        {/* Top hairline */}
        <div aria-hidden="true" className="absolute top-0 inset-x-0 h-px pointer-events-none"
          style={{ background: 'linear-gradient(to right, transparent, rgba(149,18,44,0.42), transparent)' }} />

        {/* Atmospheric glow radiating from the featured-card side */}
        <div aria-hidden="true" className="absolute pointer-events-none"
          style={{
            insetInlineEnd: '-10%', top: '-8%',
            width: '680px', height: '680px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(149,18,44,0.068) 0%, transparent 62%)',
          }} />

        {/* Editorial background watermarks */}
        <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none select-none">
          <span className="absolute font-serif font-black leading-none text-white"
            style={{ fontSize: 'clamp(88px,20vw,260px)', opacity: 0.018, top: '-2%', insetInlineEnd: '-3%', letterSpacing: '0.06em' }}>
            CRAFT
          </span>
          <span className="absolute font-serif font-black leading-none text-white"
            style={{ fontSize: 'clamp(52px,10vw,130px)', opacity: 0.013, bottom: '6%', insetInlineStart: '-1%', letterSpacing: '0.14em' }}>
            STYLE
          </span>
        </div>

        {/* ── Section header ── */}
        <div ref={servicesRef} className="reveal max-w-6xl mx-auto px-5 mb-16 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 mb-7">
            <div>
              <span className="text-terra text-[10px] font-bold uppercase tracking-[0.22em] block mb-4">מה אנחנו מציעים</span>
              <h2 className="font-serif font-black leading-[1.08] text-brown"
                style={{ fontSize: 'clamp(2.2rem, 4.5vw, 3.4rem)' }}>
                השירותים<br />
                <em className="not-italic text-terra">שלנו</em>
              </h2>
            </div>
            <p className="text-brown-mid text-sm leading-relaxed md:max-w-[210px] md:text-end">
              כל שירות מוצע ברמה הגבוהה ביותר,{' '}
              עם תשומת לב לפרטים הקטנים ביותר
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px"
              style={{ background: 'linear-gradient(to left, rgba(149,18,44,0.38), transparent)' }} />
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-terra"
              style={{ boxShadow: '0 0 9px rgba(149,18,44,0.85)' }} />
          </div>
        </div>

        {/* ── Layout ── */}
        <div className="max-w-6xl mx-auto px-5 relative z-10">

          {/* Skeleton */}
          {services.length === 0 && (
            <div className="flex flex-col lg:flex-row gap-5">
              <div className="lg:w-[44%] flex-shrink-0 rounded-3xl bg-sand/40 animate-pulse" style={{ minHeight: '420px' }} />
              <div className="flex-1 grid grid-cols-2 gap-4">
                {[1,2,3,4].map(i => <div key={i} className="rounded-3xl bg-sand/40 animate-pulse" style={{ height: '200px' }} />)}
              </div>
            </div>
          )}

          {services.length > 0 && (
            <div ref={servicesGridRef} className="flex flex-col lg:flex-row gap-5 items-stretch">

              {/* ── Featured card — first service ── */}
              <div data-stagger className="lg:w-[44%] flex-shrink-0 flex">
                <div className="card-featured w-full rounded-3xl p-9 flex flex-col relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(148deg, rgba(40,30,22,0.97) 0%, rgba(24,17,12,0.99) 100%)',
                    border    : '1px solid rgba(149,18,44,0.26)',
                    minHeight : '420px',
                  }}>

                  {/* Large faded background ordinal */}
                  <span aria-hidden="true"
                    className="absolute font-serif font-black leading-none select-none pointer-events-none"
                    style={{ fontSize: '10rem', color: 'rgba(149,18,44,0.07)', top: '-0.75rem', insetInlineStart: '1.25rem' }}>
                    01
                  </span>

                  {/* Inner bottom crimson bloom */}
                  <div aria-hidden="true" className="absolute inset-0 rounded-3xl pointer-events-none"
                    style={{ background: 'radial-gradient(ellipse 70% 45% at 50% 105%, rgba(149,18,44,0.13) 0%, transparent 70%)' }} />

                  {/* Badges row */}
                  <div className="flex items-start justify-between relative z-10">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-terra animate-pulse block"
                        style={{ boxShadow: '0 0 7px rgba(149,18,44,0.95)' }} />
                      <span className="text-terra text-[9px] font-bold uppercase tracking-[0.24em]">שירות מומלץ</span>
                    </div>
                    <span className="text-[11px] font-medium px-3 py-1.5 rounded-full"
                      style={{ background: 'rgba(149,18,44,0.11)', border: '1px solid rgba(149,18,44,0.26)', color: 'var(--color-terra)' }}>
                      {services[0].duration} דק׳
                    </span>
                  </div>

                  {/* Name + price */}
                  <div className="mt-auto pt-10 mb-8 relative z-10">
                    <h3 className="font-serif font-black text-brown leading-tight mb-5"
                      style={{ fontSize: 'clamp(1.9rem, 3.2vw, 2.7rem)' }}>
                      {services[0].name}
                    </h3>
                    {services[0].price != null && (
                      <span className="font-black text-amber leading-none"
                        style={{ fontSize: 'clamp(2rem, 3.5vw, 2.8rem)' }}>
                        ₪{services[0].price}
                      </span>
                    )}
                  </div>

                  {/* Hairline */}
                  <div className="h-px mb-7 relative z-10"
                    style={{ background: 'linear-gradient(to left, rgba(149,18,44,0.32), transparent)' }} />

                  {/* CTA */}
                  <button
                    onClick={() => scrollToBooking(services[0].id)}
                    className="btn-crimson text-white w-full py-4 rounded-2xl font-bold text-base tracking-wide relative z-10">
                    הזמן עכשיו
                  </button>
                </div>
              </div>

              {/* ── Regular cards ── */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 content-start">
                {services.slice(1).map((s, idx) => (
                  <div key={s.id} data-stagger
                    className="group card-glass rounded-3xl p-6 flex flex-col relative overflow-hidden">

                    {/* Faded background ordinal */}
                    <span aria-hidden="true"
                      className="absolute font-serif font-black leading-none select-none pointer-events-none"
                      style={{ fontSize: '5.5rem', color: 'rgba(149,18,44,0.065)', top: '-0.4rem', insetInlineStart: '0.9rem' }}>
                      {String(idx + 2).padStart(2, '0')}
                    </span>

                    {/* Duration */}
                    <div className="flex justify-end mb-3 relative z-10">
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full"
                        style={{ background: 'rgba(46,34,24,0.8)', border: '1px solid rgba(60,44,32,1)', color: 'var(--color-brown-mid)' }}>
                        {s.duration} דק׳
                      </span>
                    </div>

                    {/* Name + price */}
                    <div className="mt-7 relative z-10">
                      <h3 className="font-serif font-bold text-xl text-brown leading-snug mb-2">{s.name}</h3>
                      {s.price != null && <p className="font-black text-amber text-2xl">₪{s.price}</p>}
                    </div>

                    <div className="flex-1 min-h-5" />

                    {/* Hover accent line */}
                    <div className="h-px mb-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{ background: 'linear-gradient(to left, rgba(149,18,44,0.35), transparent)' }} />

                    {/* CTA */}
                    <button
                      onClick={() => scrollToBooking(s.id)}
                      className="w-full py-2.5 rounded-2xl text-sm font-semibold transition-all duration-300 relative z-10 group-hover:bg-terra group-hover:text-white group-hover:border-transparent"
                      style={{ background: 'rgba(46,34,24,0.70)', border: '1px solid rgba(149,18,44,0.22)', color: 'var(--color-brown-mid)' }}>
                      הזמן עכשיו
                    </button>
                  </div>
                ))}
              </div>

            </div>
          )}
        </div>
      </section>


      {/* ──────────────────────── HOW IT WORKS ──────────────────────── */}
      <section className="py-20 bg-sand relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 100%, rgba(149,18,44,0.06) 0%, transparent 70%)' }}
        />
        <div className="max-w-4xl mx-auto px-5 relative z-10">
          {/* Header */}
          <div className="text-center mb-14">
            <span className="text-terra text-[10px] font-bold uppercase tracking-[0.22em] block mb-3">
              תהליך הזמנה
            </span>
            <h2 className="font-serif font-black text-3xl sm:text-4xl text-brown">
              שלושה צעדים פשוטים
            </h2>
          </div>

          {/* Steps */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6 relative">
            {/* Connector line — desktop only */}
            <div
              aria-hidden="true"
              className="hidden sm:block absolute top-8 inset-x-[16.666%]"
              style={{ height: '1px', background: 'linear-gradient(to left, transparent, rgba(149,18,44,0.3), rgba(149,18,44,0.3), transparent)' }}
            />

            {[
              {
                n: '01',
                title: 'בחרו שירות',
                desc:  'בחרו מתוך מגוון השירותים שלנו — תספורת, עיצוב זקן ועוד',
                icon: (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8c-1.1 0-2-.89-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm0 12c-1.1 0-2-.89-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm6-7.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5.5.22.5.5-.22.5-.5.5zM19 3l-6 6 2 2 7-7V3z"/>
                  </svg>
                ),
              },
              {
                n: '02',
                title: 'בחרו תאריך ושעה',
                desc:  'ראו בזמן אמת אילו מועדים פנויים ובחרו את הזמן הנוח לכם',
                icon: (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/>
                  </svg>
                ),
              },
              {
                n: '03',
                title: 'אשרו ובואו',
                desc:  'הכניסו שם וטלפון, אשרו את התור — והגיעו אלינו בזמן',
                icon: (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                ),
              },
            ].map(({ n, title, desc, icon }) => (
              <div key={n} className="flex flex-col items-center text-center relative">
                {/* Circle */}
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mb-5 relative z-10 flex-shrink-0"
                  style={{
                    background: 'rgba(149,18,44,0.10)',
                    border: '1px solid rgba(149,18,44,0.28)',
                  }}
                >
                  <span className="text-terra">{icon}</span>
                </div>
                <span className="text-terra text-[9px] font-bold uppercase tracking-[0.22em] mb-1">{n}</span>
                <h3 className="font-serif font-bold text-lg text-brown mb-2">{title}</h3>
                <p className="text-brown-mid text-sm leading-relaxed max-w-[200px]">{desc}</p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ──────────────────────────── CTA BAND ───────────────────────── */}
      <section
        className="py-20 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #4a0817 0%, #95122c 45%, #6b0d20 100%)',
        }}
      >
        {/* Radial gold highlight at centre */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 60% 80% at 50% 50%, rgba(201,169,110,0.07) 0%, transparent 65%)',
          }}
        />
        {/* Edge vignette */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 120% 120% at 50% 50%, transparent 50%, rgba(0,0,0,0.35) 100%)',
          }}
        />

        <div ref={ctaRef} className="reveal relative z-10 max-w-2xl mx-auto px-5 text-center">
          <p className="text-white/45 text-[10px] font-bold uppercase tracking-[0.22em] mb-4">מספרת פלורנטין</p>
          <h2 className="font-serif font-black text-4xl md:text-5xl text-white mb-4">
            מוכנים לחדש את המראה?
          </h2>
          <p className="text-white/70 text-lg mb-9">
            הזמינו תור עכשיו ותהנו מהשירות הטוב ביותר בשכונה
          </p>
          <button
            onClick={() => scrollToBooking()}
            className="cta-shine border-2 border-amber/70 text-amber px-10 py-4 rounded-full text-lg font-bold hover:bg-amber/12 hover:border-amber transition-all duration-250 hover:-translate-y-0.5"
            style={{ backdropFilter: 'blur(4px)' }}
          >
            הזמינו תור עכשיו
          </button>
        </div>
      </section>

      {/* ─────────────────────── BOOKING SECTION ────────────────────── */}
      <section id="booking" ref={bookingRef} className="py-24 bg-cream relative section-glow">
        {/* Top edge line */}
        <div
          aria-hidden="true"
          className="absolute top-0 inset-x-0 h-px pointer-events-none"
          style={{ background: 'linear-gradient(to right, transparent, rgba(149,18,44,0.35), transparent)' }}
        />

        <div className="max-w-lg mx-auto px-5">

          <div ref={bookHeadRef} className="reveal text-center mb-10">
            <span className="text-terra text-[10px] font-bold uppercase tracking-[0.22em]">קביעת תור</span>
            <h2 className="font-serif font-black text-4xl text-brown mt-2 mb-2">הזמינו תור</h2>
            <p className="text-brown-mid text-sm">תהליך פשוט, מהיר ונוח לחלוטין</p>
          </div>

          {/* Step indicator */}
          {step !== 'done' && (
            <div className="flex items-center justify-center mb-8" role="list" aria-label="שלבי הזמנה">
              {(['service', 'datetime', 'details'] as Step[]).map((s, i) => {
                const current = ['service', 'datetime', 'details'].indexOf(step);
                const isActive = s === step;
                const isDone   = current > i;
                return (
                  <div key={s} className="flex items-center" role="listitem">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                          isActive
                            ? 'bg-terra text-white scale-110'
                            : isDone
                            ? 'bg-terra/20 text-terra'
                            : 'bg-sand text-brown-light'
                        }`}
                        style={isActive ? { boxShadow: '0 4px 20px rgba(149,18,44,0.5)' } : {}}
                      >
                        {isDone ? '✓' : i + 1}
                      </div>
                      <span className={`text-xs mt-1 hidden sm:block ${isActive ? 'text-brown font-semibold' : 'text-brown-light'}`}>
                        {s === 'service' ? 'שירות' : s === 'datetime' ? 'מועד' : 'פרטים'}
                      </span>
                    </div>
                    {i < 2 && (
                      <div
                        className={`w-12 h-px mx-1 mb-4 transition-colors ${isDone ? 'bg-terra/50' : 'bg-sand/60'}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Booking card */}
          <div
            className="bg-sand rounded-3xl p-5 sm:p-8"
            style={{
              border: '1px solid rgba(149,18,44,0.14)',
              boxShadow: '0 8px 48px rgba(0,0,0,0.45), 0 0 0 1px rgba(149,18,44,0.07)',
            }}
          >

            {/* ── Step 1: Service ── */}
            {step === 'service' && (
              <div>
                <h3 className="font-serif font-bold text-2xl text-brown mb-6">בחרו שירות</h3>
                <div className="grid gap-3" role="listbox" aria-label="בחירת שירות">
                  {!servicesFetched && (
                    <>
                      {[1,2,3].map(i => <div key={i} className="bg-sand/40 rounded-2xl h-16 animate-pulse" />)}
                    </>
                  )}
                  {services.map(s => (
                    <button
                      key={s.id}
                      role="option"
                      aria-selected={serviceId === s.id}
                      onClick={() => { setServiceId(s.id); setStep('datetime'); setDate(''); setTime(''); setAvailableSlots(null); setAvailabilityError(false); }}
                      className={`w-full text-right rounded-2xl p-4 transition-all border-2 ${
                        serviceId === s.id
                          ? 'border-terra bg-terra/8'
                          : 'border-border/60 hover:border-terra/40 hover:bg-terra/4'
                      }`}
                      style={serviceId === s.id ? { background: 'rgba(149,18,44,0.08)' } : {}}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-brown">{s.name}</div>
                          <div className="text-sm text-brown-light mt-0.5">
                            {s.duration} דקות
                            {s.price != null && <span className="mr-2 text-amber font-semibold">· ₪{s.price}</span>}
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 transition-all ${
                          serviceId === s.id ? 'border-terra bg-terra' : 'border-border'
                        }`} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Step 2: Date & Time ── */}
            {step === 'datetime' && (
              <div>
                <h3 className="font-serif font-bold text-2xl text-brown mb-6">בחרו תאריך ושעה</h3>

                <label htmlFor="booking-date" className="block text-sm font-medium text-brown-mid mb-1.5">תאריך</label>
                <input
                  id="booking-date"
                  type="date"
                  min={today}
                  value={date}
                  onChange={e => { setDate(e.target.value); setTime(''); setAvailableSlots(null); setAvailabilityError(false); }}
                  className="w-full border-2 rounded-2xl p-3 mb-6 text-base input-dark transition-all"
                />

                {date && availableSlots !== null && availableSlots.length === 0 && (
                  <p className="text-brown-mid text-sm py-2">אין שעות פנויות בתאריך הזה. נסו לבחור תאריך אחר.</p>
                )}

                {date && availableSlots !== null && availableSlots.length > 0 && (
                  <>
                    <label className="block text-sm font-medium text-brown-mid mb-2">שעה פנויה</label>
                    <div className="grid grid-cols-3 gap-2" role="listbox" aria-label="שעות פנויות">
                      {availableSlots.map(slot => (
                        <button
                          key={slot}
                          role="option"
                          aria-selected={time === slot}
                          onClick={() => setTime(slot)}
                          className={`py-3 rounded-2xl border-2 font-semibold text-sm transition-all ${
                            time === slot
                              ? 'border-terra bg-terra text-white'
                              : 'border-border/60 text-brown-mid hover:border-terra/40 hover:bg-terra/5'
                          }`}
                          style={time === slot ? { boxShadow: '0 4px 16px rgba(149,18,44,0.4)' } : {}}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {date && availableSlots === null && !availabilityError && (
                  <p className="text-brown-light text-sm">טוען זמינות...</p>
                )}
                {availabilityError && (
                  <p className="text-red-400 text-sm py-2">שגיאה בטעינת הזמינות. אנא נסו שנית.</p>
                )}

                <div className="flex gap-3 mt-7">
                  <button
                    onClick={() => setStep('service')}
                    className="flex-1 py-3 border border-border/70 rounded-2xl text-brown-mid hover:bg-sand/50 transition-colors font-medium"
                  >
                    חזרה
                  </button>
                  <button
                    onClick={() => setStep('details')}
                    disabled={!date || !time}
                    className="flex-1 py-3 text-white rounded-2xl font-semibold btn-crimson"
                  >
                    המשך
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 3: Details ── */}
            {step === 'details' && (
              <div>
                <h3 className="font-serif font-bold text-2xl text-brown mb-6">הפרטים שלכם</h3>

                {/* Summary box */}
                <div
                  className="rounded-2xl p-4 mb-6 border"
                  style={{ background: 'rgba(149,18,44,0.05)', borderColor: 'rgba(149,18,44,0.15)' }}
                >
                  <p className="text-[10px] font-bold text-terra uppercase tracking-widest mb-3">סיכום הזמנה</p>
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-brown-mid">שירות</span>
                      <span className="font-semibold text-brown">{service?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-brown-mid">משך</span>
                      <span className="text-brown">{service?.duration} דקות</span>
                    </div>
                    {service?.price != null && (
                      <div className="flex justify-between">
                        <span className="text-brown-mid">מחיר</span>
                        <span className="font-bold text-amber">₪{service.price}</span>
                      </div>
                    )}
                    <div className="border-t border-border/50 my-0.5" />
                    <div className="flex justify-between">
                      <span className="text-brown-mid">תאריך</span>
                      <span className="font-semibold text-brown">
                        {new Date(date + 'T12:00:00').toLocaleDateString('he-IL', {
                          weekday: 'long', day: 'numeric', month: 'long',
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-brown-mid">שעה</span>
                      <span className="font-black text-terra text-base">{time}</span>
                    </div>
                  </div>
                </div>

                <label htmlFor="booking-name" className="block text-sm font-medium text-brown-mid mb-1.5">שם מלא</label>
                <input
                  id="booking-name"
                  type="text"
                  placeholder="ישראל ישראלי"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full border-2 rounded-2xl p-3 mb-4 text-base input-dark transition-all"
                />

                <label htmlFor="booking-phone" className="block text-sm font-medium text-brown-mid mb-1.5">טלפון</label>
                <input
                  id="booking-phone"
                  type="tel"
                  placeholder="0501234567"
                  value={phone}
                  onChange={e => handlePhoneChange(e.target.value)}
                  maxLength={10}
                  aria-invalid={!!phoneError}
                  aria-describedby={phoneError ? 'phone-error' : undefined}
                  className={`w-full border-2 rounded-2xl p-3 mb-1 text-base transition-all ${
                    phoneError
                      ? 'border-red-500/60 bg-red-900/10 text-brown focus:border-red-400 focus:outline-none'
                      : 'input-dark'
                  }`}
                />
                {phoneError
                  ? <p id="phone-error" className="text-red-400 text-sm mb-4">{phoneError}</p>
                  : <div className="mb-4" />}

                {bookingError && <p className="text-red-400 text-sm mb-4">{bookingError}</p>}

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('datetime')}
                    className="flex-1 py-3 border border-border/70 rounded-2xl text-brown-mid hover:bg-sand/50 transition-colors font-medium"
                  >
                    חזרה
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!name || !phone || !!phoneError || loading}
                    className="flex-1 py-3 text-white rounded-2xl font-semibold btn-crimson"
                  >
                    {loading ? 'שולח...' : 'אשרו תור'}
                  </button>
                </div>

                {/* Trust micro-copy */}
                <p className="text-center text-brown-light text-xs mt-4 leading-relaxed">
                  ניתן לבטל את התור בכל עת דרך הקישור שיישלח אליכם
                </p>
              </div>
            )}

            {/* ── Step 4: Done ── */}
            {step === 'done' && (
              <div className="text-center py-2">
                <div
                  className="w-20 h-20 bg-terra/10 rounded-full flex items-center justify-center mx-auto mb-5"
                  style={{ boxShadow: '0 0 32px rgba(149,18,44,0.25)' }}
                >
                  <span className="text-3xl text-terra font-black">✓</span>
                </div>
                <h3 className="font-serif font-black text-2xl text-brown mb-1">התור נקבע בהצלחה!</h3>
                <p className="text-brown-mid text-sm mb-7">נתראה בקרוב</p>

                <div
                  className="rounded-2xl p-4 mb-5 text-right border"
                  style={{ background: 'rgba(149,18,44,0.05)', borderColor: 'rgba(149,18,44,0.15)' }}
                >
                  <p className="text-[10px] font-bold text-terra uppercase tracking-widest mb-3">פרטי התור שלכם</p>
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-brown-mid">שירות</span>
                      <span className="font-semibold text-brown">{service?.name}</span>
                    </div>
                    {service?.price != null && (
                      <div className="flex justify-between">
                        <span className="text-brown-mid">מחיר</span>
                        <span className="font-bold text-amber">₪{service.price}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-brown-mid">תאריך</span>
                      <span className="font-semibold text-brown">
                        {new Date(date + 'T12:00:00').toLocaleDateString('he-IL', {
                          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-brown-mid">שעה</span>
                      <span className="font-black text-terra text-base">{time}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-brown-mid">שם</span>
                      <span className="text-brown">{name}</span>
                    </div>
                  </div>
                </div>

                {bookingToken && (
                  <div
                    className="rounded-2xl p-4 mb-5 text-right border"
                    style={{ background: 'rgba(149,18,44,0.06)', borderColor: 'rgba(149,18,44,0.18)' }}
                  >
                    <p className="text-sm font-semibold text-brown mb-1">קישור אישי לצפייה ובביטול התור</p>
                    <p className="text-xs text-brown-mid mb-3">שמרו את הקישור הזה לניהול התור שלכם</p>
                    <div className="flex gap-2">
                      <a
                        href={`/appointment/${bookingToken}`}
                        target="_blank"
                        className="flex-1 text-center py-2 text-sm rounded-xl text-terra truncate border border-terra/25 hover:bg-terra/8 transition-colors"
                        style={{ background: 'rgba(149,18,44,0.05)' }}
                      >
                        /appointment/{bookingToken.slice(0, 12)}...
                      </a>
                      <button
                        onClick={copyLink}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                          linkCopied
                            ? 'bg-green-600/80 text-white'
                            : 'btn-crimson text-white'
                        }`}
                      >
                        {linkCopied ? '✓ הועתק' : 'העתק'}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={reset}
                  className="w-full py-3 text-white rounded-2xl font-semibold btn-crimson"
                >
                  הזמינו תור נוסף
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ──────────────────── STICKY MOBILE CTA ────────────────────── */}
      {/* Visible only on mobile, only when scrolled past hero, hidden when booking section in view */}
      <div
        aria-hidden={!scrolled || inBookingView}
        className={`sm:hidden fixed bottom-0 inset-x-0 z-40 px-4 pb-4 pt-3 transition-all duration-300 ${
          scrolled && !inBookingView
            ? 'translate-y-0 opacity-100 pointer-events-auto'
            : 'translate-y-full opacity-0 pointer-events-none'
        }`}
        style={{ background: 'linear-gradient(to top, rgba(16,12,8,0.97) 60%, transparent)' }}
      >
        <button
          onClick={() => scrollToBooking()}
          className="btn-crimson w-full py-4 rounded-2xl text-white font-bold text-base"
        >
          הזמינו תור
        </button>
      </div>

      {/* ──────────────────────────── FOOTER ─────────────────────────── */}
      <footer
        className="text-white/70"
        style={{
          background: 'linear-gradient(to bottom, #0d0a07, #100c08)',
          borderTop: '1px solid rgba(149,18,44,0.14)',
        }}
      >
        <div className="max-w-5xl mx-auto px-5 py-14">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">

            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span
                  className="w-9 h-9 bg-terra rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ boxShadow: '0 0 14px rgba(149,18,44,0.4)' }}
                >
                  <ScissorsIcon className="w-4 h-4 text-white" />
                </span>
                <span className="font-serif font-black text-2xl text-white">פלורנטין</span>
              </div>
              <p className="text-sm leading-relaxed text-white/45">
                מספרה שכונתית עם לב גדול. אצלנו כל לקוח מקבל יחס אישי ושירות ברמה הגבוהה ביותר.
              </p>
            </div>

            {/* Hours */}
            <div>
              <h4 className="font-semibold text-white/80 text-sm uppercase tracking-widest mb-4">שעות פתיחה</h4>
              <div className="text-sm space-y-2 text-white/45">
                <div className="flex justify-between"><span>ראשון – חמישי</span><span>09:00 – 19:00</span></div>
                <div className="flex justify-between"><span>שישי</span><span>08:00 – 14:00</span></div>
                <div className="flex justify-between"><span>שבת</span><span>סגור</span></div>
              </div>
            </div>

            {/* Contact + Links */}
            <div>
              <h4 className="font-semibold text-white/80 text-sm uppercase tracking-widest mb-4">יצירת קשר</h4>
              <div className="text-sm space-y-2 text-white/45 mb-6">
                <p>050-444-7823</p>
                <p>רחוב פלורנטין 12, תל אביב</p>
                <p className="text-white/25 text-xs">ניתן להזמין גם בוואטסאפ</p>
              </div>
              <div className="flex flex-col gap-2 text-sm">
                <a href="#services" className="text-white/40 hover:text-white/75 transition-colors">שירותים</a>
                <a href="/about"    className="text-white/40 hover:text-white/75 transition-colors">אודות</a>
                <a href="#booking"  className="text-white/40 hover:text-white/75 transition-colors">הזמנת תור</a>
              </div>
            </div>
          </div>

          <div
            className="pt-6 text-center text-xs text-white/20"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
          >
            <span>© {new Date().getFullYear()} מספרת פלורנטין. כל הזכויות שמורות.</span>
          </div>
        </div>
      </footer>
    </>
  );
}
