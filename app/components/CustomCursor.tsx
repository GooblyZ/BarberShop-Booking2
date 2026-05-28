'use client';

import { useEffect, useRef } from 'react';

/* ─────────────────────────────────────────────────────────────────────────────
   CUSTOM CURSOR — Luxury barbershop precision cursor
   ─────────────────────────────────────────────────
   Layer stack (back → front):
     1. Trail rings   — 5 fading echoes of the ring's past positions
     2. Ring          — outer glow ring, morphs shape/color per context
     3. Hero reticle  — precision crosshair, visible in hero section only
     4. Dot           — 4 px crimson dot, snaps to the exact pointer position

   Motion:
     Dot  follows pointer at lerp t = 0.65  (snappy, click-accurate)
     Ring follows pointer at lerp t = 0.10  (dreamy, cinematic trail)
     Magnetic pull adds a gentle offset toward hovered link centres.

   Modes & ring treatment:
     default  30 px  crimson ring, soft glow
     button   44 px  bright crimson ring, strong glow + light fill
     link     36 px  bright crimson ring, magnetic centre-pull
     hero     38 px  amber/gold ring + crosshair reticle + spark particles
     card     40×28  slightly wider ring (horizontal stretch feel)
     input        0  ring hidden — native text cursor restored on inputs

   Customisation:
     • Glow colour  →  edit the rgba() values in the RING_STYLES map below
     • Ring sizes   →  edit the W / H values in the RING_STYLES map below
     • Lerp speed   →  change R_LERP (ring) or D_LERP (dot) constants
     • Trail length →  change TRAIL_N constant + matching JSX array
     • Spark rate   →  change SPARK_MS constant
     • Hero colour  →  change AMBER_* constants
─────────────────────────────────────────────────────────────────────────────*/

type Mode = 'default' | 'button' | 'link' | 'hero' | 'card' | 'input';

// ── Tuning constants ──────────────────────────────────────────────────────────
const R_LERP   = 0.10;   // ring interpolation factor  (lower = dreamier)
const D_LERP   = 0.65;   // dot  interpolation factor  (higher = snappier)
const TRAIL_N  = 4;      // number of trail echo rings
const SPARK_N  = 4;      // spark particle pool size
const SPARK_MS = 520;    // minimum ms between hero sparks

// ── Ring style map ────────────────────────────────────────────────────────────
// Each entry drives direct style writes in the RAF tick.
// w / h  in px;  bc = borderColor;  bg = background fill;  glow = box-shadow
const RING_STYLES: Record<Mode, {
  w: number; h: number;
  bc: string; bg: string; glow: string;
}> = {
  default: {
    w: 32, h: 32,
    bc  : 'rgba(196,24,58,0.90)',
    bg  : 'rgba(149,18,44,0.06)',
    glow: '0 0 14px rgba(149,18,44,0.50), 0 0 30px rgba(149,18,44,0.18), inset 0 1px 0 rgba(255,255,255,0.08)',
  },
  button: {
    w: 46, h: 46,
    bc  : 'rgba(220,30,60,0.95)',
    bg  : 'rgba(149,18,44,0.10)',
    glow: '0 0 22px rgba(149,18,44,0.70), 0 0 44px rgba(149,18,44,0.28), inset 0 0 10px rgba(149,18,44,0.10)',
  },
  link: {
    w: 38, h: 38,
    bc  : 'rgba(220,30,60,0.92)',
    bg  : 'rgba(149,18,44,0.07)',
    glow: '0 0 16px rgba(149,18,44,0.55), 0 0 32px rgba(149,18,44,0.20)',
  },
  hero: {
    w: 40, h: 40,
    bc  : 'rgba(201,169,110,0.80)',   // amber — cinematic gold
    bg  : 'transparent',
    glow: '0 0 16px rgba(201,169,110,0.38), 0 0 32px rgba(201,169,110,0.14)',
  },
  card: {
    w: 42, h: 30,
    bc  : 'rgba(196,24,58,0.85)',
    bg  : 'rgba(149,18,44,0.05)',
    glow: '0 0 14px rgba(149,18,44,0.42)',
  },
  input: {
    w: 0, h: 0,
    bc: 'transparent', bg: 'transparent', glow: 'none',
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

/** Walk up the DOM to determine which cursor mode applies. */
function detectMode(el: Element | null): { mode: Mode; link: Element | null } {
  let node = el;
  while (node && node !== document.documentElement) {
    const tag = node.tagName;

    // 1 — Explicit button elements (highest priority for usability)
    if (node.matches('button,[role="button"],input[type="submit"],input[type="button"],.btn-crimson'))
      return { mode: 'button', link: null };

    // 2 — Form inputs: restore native text cursor
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')
      return { mode: 'input', link: null };

    // 3 — Hero section: cinematic reticle experience
    if (node.closest('#hero'))
      return { mode: 'hero', link: null };

    // 4 — Glass cards
    if (node.matches('.card-glass') || node.closest('.card-glass'))
      return { mode: 'card', link: null };

    // 5 — Links
    if (tag === 'A')
      return { mode: 'link', link: node };

    node = node.parentElement;
  }
  return { mode: 'default', link: null };
}

// ─────────────────────────────────────────────────────────────────────────────

export default function CustomCursor() {
  const rootRef   = useRef<HTMLDivElement>(null);
  const ringRef   = useRef<HTMLDivElement>(null);
  const dotRef    = useRef<HTMLDivElement>(null);
  const heroXRef  = useRef<HTMLDivElement>(null);
  const trailRefs = useRef<(HTMLDivElement | null)[]>([]);
  const sparkRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    // ── Guard: touch devices & reduced-motion ─────────────────────────
    const isTouch  = window.matchMedia('(hover: none), (pointer: coarse)').matches;
    const noMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isTouch) return;

    const root  = rootRef.current;
    const ring  = ringRef.current;
    const dot   = dotRef.current;
    const heroX = heroXRef.current;
    if (!root || !ring || !dot || !heroX) return;

    // Inject a high-priority style tag to suppress the native cursor.
    // This beats Tailwind utilities and browser UA rules that cursor:none
    // in globals.css alone can't override (specificity conflict).
    const styleEl = document.createElement('style');
    styleEl.dataset.id = 'custom-cursor-hide';
    styleEl.textContent =
      '*, *::before, *::after { cursor: none !important; }' +
      'input, textarea, select { cursor: text !important; }';
    document.head.appendChild(styleEl);

    root.style.opacity = '0';   // hidden until first mousemove

    // ── Mutable hot-path state (no React re-renders) ──────────────────
    let mx = -400, my = -400;   // raw pointer
    let rx = -400, ry = -400;   // ring (lerped)
    let dx = -400, dy = -400;   // dot  (lerped)
    let mode: Mode = 'default';
    let hoveredLink: Element | null = null;
    let lastSpark = 0;
    let sparkIdx  = 0;
    let entered   = false;
    let rafId     = 0;

    // Trail circular buffer of ring positions
    const trail: [number, number][] =
      Array.from({ length: TRAIL_N }, () => [-400, -400] as [number, number]);

    // ── Spark particle spawner ────────────────────────────────────────
    const spawnSpark = (x: number, y: number, ts: number) => {
      if (ts - lastSpark < SPARK_MS) return;
      lastSpark = ts;

      const el = sparkRefs.current[sparkIdx % SPARK_N];
      sparkIdx++;
      if (!el) return;

      const angle = Math.random() * Math.PI * 2;
      const dist  = 10 + Math.random() * 18;
      const tx    = x + Math.cos(angle) * dist;
      const ty    = y + Math.sin(angle) * dist;
      const size  = 1.5 + Math.random() * 1.5;
      const dur   = 460 + Math.random() * 240;

      // Snap to current position, then animate outward via transition
      el.style.cssText = [
        'position:fixed;top:0;left:0;border-radius:50%;pointer-events:none;',
        `width:${size}px;height:${size}px;`,
        'background:rgba(149,18,44,0.9);',
        'box-shadow:0 0 5px rgba(149,18,44,0.65);',
        `transform:translate3d(${x}px,${y}px,0) translate(-50%,-50%);`,
        'opacity:1;',
        `transition:transform ${dur}ms cubic-bezier(0.1,0.5,0.4,1),opacity ${dur}ms ease;`,
        'z-index:9997;',
      ].join('');

      void el.offsetHeight; // force reflow so transition fires

      el.style.transform = `translate3d(${tx}px,${ty}px,0) translate(-50%,-50%)`;
      el.style.opacity   = '0';
    };

    // ── Main RAF loop ─────────────────────────────────────────────────
    const tick = (ts: number) => {
      rafId = requestAnimationFrame(tick);

      const rT = noMotion ? 1 : R_LERP;
      const dT = noMotion ? 1 : D_LERP;

      // Magnetic pull toward link centre
      let tmx = mx, tmy = my;
      if (mode === 'link' && hoveredLink) {
        const r  = hoveredLink.getBoundingClientRect();
        const cx = r.left + r.width  / 2;
        const cy = r.top  + r.height / 2;
        tmx += (cx - mx) * 0.14;
        tmy += (cy - my) * 0.14;
      }

      rx = lerp(rx, tmx, rT);
      ry = lerp(ry, tmy, rT);
      dx = lerp(dx, mx,  dT);
      dy = lerp(dy, my,  dT);

      // Update trail (newest first)
      trail.unshift([rx, ry]);
      trail.length = TRAIL_N;

      // ── Ring ───────────────────────────────────────────────────────
      if (mode === 'input') {
        ring.style.opacity  = '0';
        heroX.style.opacity = '0';
      } else {
        ring.style.opacity = '1';
        ring.style.transform =
          `translate3d(${rx}px,${ry}px,0) translate(-50%,-50%)`;

        const s = RING_STYLES[mode];
        ring.style.width       = `${s.w}px`;
        ring.style.height      = `${s.h}px`;
        ring.style.borderColor = s.bc;
        ring.style.background  = s.bg;
        ring.style.boxShadow   = s.glow;

        // Hero-only: crosshair + sparks
        if (mode === 'hero') {
          heroX.style.opacity   = '1';
          heroX.style.transform =
            `translate3d(${rx}px,${ry}px,0) translate(-50%,-50%)`;
          spawnSpark(rx, ry, ts);
        } else {
          heroX.style.opacity = '0';
        }
      }

      // ── Dot ────────────────────────────────────────────────────────
      dot.style.opacity   = mode === 'input' ? '0' : '1';
      dot.style.transform = `translate3d(${dx}px,${dy}px,0) translate(-50%,-50%)`;

      // ── Trail ──────────────────────────────────────────────────────
      trailRefs.current.forEach((el, i) => {
        if (!el) return;
        const [tx, ty] = trail[i + 1] ?? trail[TRAIL_N - 1];
        const frac = 1 - (i + 1) / TRAIL_N;          // 1 → 0 oldest
        const sz   = 2 + frac * 9;
        el.style.transform = `translate3d(${tx}px,${ty}px,0) translate(-50%,-50%)`;
        el.style.opacity   = mode === 'input' ? '0' : (frac * 0.16).toFixed(3);
        el.style.width     = `${sz.toFixed(1)}px`;
        el.style.height    = `${sz.toFixed(1)}px`;
      });
    };

    // ── Event listeners ───────────────────────────────────────────────
    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      if (!entered) {
        entered = true;
        // Snap everything to pointer on first move — no jarring slide-in
        rx = mx; ry = my;
        dx = mx; dy = my;
        trail.fill([mx, my]);
        root.style.opacity = '1';
      }
    };

    const onOver = (e: Event) => {
      const result    = detectMode((e as MouseEvent).target as Element);
      mode            = result.mode;
      hoveredLink     = result.link;
    };

    const onLeave = () => { root.style.opacity = '0'; };
    const onEnter = () => { if (entered) root.style.opacity = '1'; };

    document.addEventListener('mousemove',   onMove, { passive: true });
    document.addEventListener('pointerover', onOver, { passive: true });
    document.addEventListener('mouseleave',  onLeave);
    document.addEventListener('mouseenter',  onEnter);

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      styleEl.remove();
      document.removeEventListener('mousemove',   onMove);
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('mouseleave',  onLeave);
      document.removeEventListener('mouseenter',  onEnter);
    };
  }, []);

  // ── JSX: all elements start at top:0 left:0, positioned via transform ──
  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      style={{
        position     : 'fixed',
        inset        : 0,
        pointerEvents: 'none',
        zIndex       : 9999,
        opacity      : 0,
        transition   : 'opacity 0.35s ease',
      }}
    >

      {/* ── Trail echo rings ── */}
      {Array.from({ length: TRAIL_N }, (_, i) => (
        <div
          key={i}
          ref={el => { trailRefs.current[i] = el; }}
          style={{
            position    : 'fixed',
            top         : 0,
            left        : 0,
            borderRadius: '50%',
            background  : 'rgba(196,24,58,0.75)',
            pointerEvents: 'none',
            willChange  : 'transform, opacity',
          }}
        />
      ))}

      {/* ── Outer ring ── */}
      <div
        ref={ringRef}
        style={{
          position    : 'fixed',
          top         : 0,
          left        : 0,
          width       : '30px',
          height      : '30px',
          borderRadius: '50%',
          border      : '2px solid rgba(196,24,58,0.90)',
          pointerEvents: 'none',
          willChange  : 'transform, width, height, border-color, box-shadow',
          // CSS transitions handle mode-change morphs; RAF handles position
          transition  : [
            'width 0.20s cubic-bezier(0.34,1.56,0.64,1)',
            'height 0.20s cubic-bezier(0.34,1.56,0.64,1)',
            'border-color 0.22s ease',
            'box-shadow 0.22s ease',
            'background 0.22s ease',
            'opacity 0.18s ease',
          ].join(','),
        }}
      />

      {/* ── Hero precision reticle (camera/cutting reticle aesthetic) ── */}
      <div
        ref={heroXRef}
        style={{
          position    : 'fixed',
          top         : 0,
          left        : 0,
          width       : '34px',
          height      : '34px',
          pointerEvents: 'none',
          opacity     : 0,
          willChange  : 'transform, opacity',
          transition  : 'opacity 0.20s ease',
        }}
      >
        <svg
          viewBox="0 0 34 34"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: '100%', height: '100%' }}
        >
          {/* Horizontal — left arm */}
          <line x1="0"    y1="17" x2="12"   y2="17" stroke="rgba(201,169,110,0.70)" strokeWidth="0.9" />
          {/* Horizontal — right arm */}
          <line x1="22"   y1="17" x2="34"   y2="17" stroke="rgba(201,169,110,0.70)" strokeWidth="0.9" />
          {/* Vertical — top arm */}
          <line x1="17"   y1="0"  x2="17"   y2="12" stroke="rgba(201,169,110,0.70)" strokeWidth="0.9" />
          {/* Vertical — bottom arm */}
          <line x1="17"   y1="22" x2="17"   y2="34" stroke="rgba(201,169,110,0.70)" strokeWidth="0.9" />
          {/* Centre pip */}
          <circle cx="17" cy="17" r="1.2" fill="rgba(201,169,110,0.85)" />
        </svg>
      </div>

      {/* ── Precise centre dot ── */}
      <div
        ref={dotRef}
        style={{
          position    : 'fixed',
          top         : 0,
          left        : 0,
          width       : '5px',
          height      : '5px',
          borderRadius: '50%',
          background  : '#e8183a',
          boxShadow   : '0 0 6px rgba(149,18,44,0.75), 0 0 12px rgba(149,18,44,0.28)',
          pointerEvents: 'none',
          willChange  : 'transform',
          transition  : 'opacity 0.15s ease',
        }}
      />

      {/* ── Spark particle pool (hero hover) ── */}
      {Array.from({ length: SPARK_N }, (_, i) => (
        <div
          key={`sp-${i}`}
          ref={el => { sparkRefs.current[i] = el; }}
          style={{ position: 'fixed', top: 0, left: 0, pointerEvents: 'none' }}
        />
      ))}

    </div>
  );
}
