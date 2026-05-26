'use client';

import { useEffect, useRef } from 'react';

// ─── Frame sequence config ────────────────────────────────────────────────────
const FRAME_COUNT = 120;
const FRAME_PATH  = (index: number) =>
  `/hero-frames/frame_${String(index).padStart(4, '0')}.jpg`;

// ─── Cinematic text scenes (Hebrew) ──────────────────────────────────────────
//  start / end – scroll-progress window [0, 1] for each scene.
//  Adjacent scenes overlap ~0.06 so opacity crossfades between beats.
//
//  Beat map:
//   01  0 % – 25 %   תספורות מדויקות       ימין-מרכז  (RTL start-center)
//   02 25 % – 50 %   הזמנת תור בקלות        שמאל-מרכז  (RTL end-center)
//   03 50 % – 75 %   חוויית ספרות מודרנית   מרכז-תחתון
//   04 75 % –100 %   קבעו תור היום          מרכז-מרכז  ← CTA
interface Scene {
  start   : number;
  end     : number;
  title   : string;
  sub     : string;
  flexCls : string;  // flex alignment of the full-screen outer container
  enterTx : number;  // entry X offset (px) – slides to 0 on fade-in
  enterTy : number;  // entry Y offset (px) – slides to 0 on fade-in
  hasCta ?: boolean;
}

// Fraction of each scene used for fade-in / fade-out ramps.
const FADE = 0.18;

const SCENES: Scene[] = [
  {
    // start: -0.10 → at progress=0, local=0.25 > FADE(0.18) so opacity is already 1.
    // This means the scroll system can own scene 01 from the very first tick
    // with no opacity jump, and the staggered child animations handle the entrance.
    start: -0.10, end: 0.30,
    title  : 'תספורות מדויקות',
    sub    : 'תוצאות חדות. בלי בלגן.',
    // RTL: justify-start = right side of viewport → natural Hebrew reading start
    flexCls: 'justify-center md:justify-start items-center',
    // Enters from the right (RTL start direction)
    enterTx: 32, enterTy: 0,
  },
  {
    start: 0.22, end: 0.55,
    title  : 'הזמנת תור בקלות',
    sub    : 'בחרו שירות, קבעו שעה, הגיעו.',
    // RTL: justify-end = left side of viewport
    flexCls: 'justify-center md:justify-end items-center',
    // Enters from the left (RTL end direction)
    enterTx: -32, enterTy: 0,
  },
  {
    start: 0.47, end: 0.80,
    title  : 'חוויית ספרות מודרנית',
    sub    : 'מהגלילה הראשונה ועד התספורת המושלמת.',
    flexCls: 'justify-center items-end',
    enterTx: 0, enterTy: 20,
  },
  {
    start: 0.72, end: 1.00,
    title  : 'קבעו תור היום',
    sub    : 'התור הבא שלך — במרחק לחיצה אחת.',
    flexCls: 'justify-center items-center',
    enterTx: 0, enterTy: 20,
    hasCta : true,
  },
];

// ─────────────────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) {
  return Math.min(Math.max(v, lo), hi);
}

function drawCover(
  ctx : CanvasRenderingContext2D,
  img : HTMLImageElement,
  cw  : number,
  ch  : number,
) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (!iw || !ih) return;
  const ir = iw / ih;
  const cr = cw / ch;
  let sx = 0, sy = 0, sw = iw, sh = ih;
  if (ir > cr) { sw = ih * cr; sx = (iw - sw) / 2; }
  else         { sh = iw / cr; sy = (ih - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
}

export default function ScrollVideoHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);

  // ── Canvas hot-path refs (unchanged from canvas-only version) ─────────
  const framesRef    = useRef<HTMLImageElement[]>([]);
  const loadedRef    = useRef(0);
  const frameIdxRef  = useRef(0);
  const targetIdxRef = useRef(0);
  const rafIdRef     = useRef<number>(0);
  const activeRef    = useRef(false);
  const dirtyRef     = useRef(false);

  // ── Text-layer refs ────────────────────────────────────────────────────
  const progressRef    = useRef(0);
  const textDirtyRef   = useRef(false);

  // Direct DOM refs for each scene — opacity/transform written without setState.
  const sceneElsRef = useRef<(HTMLDivElement | null)[]>(
    Array.from({ length: SCENES.length }, () => null),
  );

  // CTA anchor: pointer-events toggled independently of the scene container.
  const ctaRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const canvas  = canvasRef.current;
    if (!section || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ── Canvas helpers (unchanged) ────────────────────────────────────────
    const resizeCanvas = () => {
      const dpr     = window.devicePixelRatio || 1;
      canvas.width  = canvas.offsetWidth  * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.scale(dpr, dpr);
      dirtyRef.current = true;
    };

    const drawFrame = (index: number) => {
      const img = framesRef.current[index];
      if (!img?.complete || !img.naturalWidth) return;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);
      drawCover(ctx, img, w, h);
      frameIdxRef.current = index;
      dirtyRef.current    = false;
    };

    // ── Text layer: direct DOM writes, zero React re-renders ─────────────
    const updateTextLayer = (progress: number) => {
      sceneElsRef.current.forEach((el, i) => {
        if (!el) return;

        const s     = SCENES[i];
        const span  = s.end - s.start;
        const local = span > 0 ? clamp((progress - s.start) / span, 0, 1) : 0;
        const last  = i === SCENES.length - 1;

        // Opacity: fade-in ramp → full → fade-out ramp (last scene stays at 1).
        let opacity: number;
        if      (local <= FADE)              opacity = local / FADE;
        else if (!last && local >= 1 - FADE) opacity = (1 - local) / FADE;
        else                                 opacity = 1;
        opacity = clamp(opacity, 0, 1);

        // Transform: slide in from entry direction, always drift upward on exit.
        let tx = 0, ty = 0;
        if (local <= FADE) {
          const t = 1 - local / FADE;            // 1 → 0 while fading in
          tx = s.enterTx * t;
          ty = s.enterTy * t;
        } else if (!last && local >= 1 - FADE) {
          const t = (local - (1 - FADE)) / FADE; // 0 → 1 while fading out
          tx = -s.enterTx * t;
          ty = -(Math.abs(s.enterTy) || 14) * t; // drift upward regardless of axis
        }

        el.style.opacity   = (Math.round(opacity * 1000) / 1000).toString();
        el.style.transform = `translate(${tx.toFixed(2)}px,${ty.toFixed(2)}px)`;
      });

      // CTA: enable pointer-events once the last scene is past its fade-in.
      if (ctaRef.current) {
        const last  = SCENES[SCENES.length - 1];
        const span  = last.end - last.start;
        const local = span > 0 ? clamp((progress - last.start) / span, 0, 1) : 0;
        ctaRef.current.style.pointerEvents = local > FADE ? 'auto' : 'none';
      }

      textDirtyRef.current = false;
    };

    // ── Reduced-motion: static first frame + scene 01 pinned ─────────────
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      resizeCanvas();
      const still  = new Image();
      still.onload = () => drawFrame(0);
      still.src    = FRAME_PATH(1);
      framesRef.current[0] = still;

      const el = sceneElsRef.current[0];
      if (el) { el.style.opacity = '1'; el.style.transform = 'translate(0,0)'; }

      const onResizeRM = () => { resizeCanvas(); drawFrame(0); };
      window.addEventListener('resize', onResizeRM, { passive: true });
      return () => window.removeEventListener('resize', onResizeRM);
    }

    // ── Preload all 96 frames in parallel ─────────────────────────────────
    const frames: HTMLImageElement[] = new Array(FRAME_COUNT);
    framesRef.current = frames;

    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = new Image();
      img.onload = () => {
        loadedRef.current++;
        if (i === 0) { resizeCanvas(); drawFrame(0); }
      };
      img.src  = FRAME_PATH(i + 1);   // files are 1-indexed (frame_0001…frame_0120)
      frames[i] = img;
    }

    // ── updateTarget: compute progress, update canvas + text refs ─────────
    //  Called both from the mount seed AND from scroll events.
    //  Only the scroll event handler sets userScrolledRef, so the initial
    //  seed call cannot accidentally cancel scene 01's CSS animation.
    const updateTarget = () => {
      const rect       = section.getBoundingClientRect();
      const scrollable = section.offsetHeight - window.innerHeight;
      const progress   = clamp(-rect.top / scrollable, 0, 1);

      progressRef.current  = progress;
      textDirtyRef.current = true;

      // Math.floor gives every frame an equal-width progress interval.
      // Math.round would make some frames cover a wider range (skipping neighbours).
      // The explicit min/max clamp guarantees we never go out of bounds.
      const idx = Math.min(
        FRAME_COUNT - 1,
        Math.max(0, Math.floor(progress * (FRAME_COUNT - 1))),
      );
      if (idx !== targetIdxRef.current) {
        targetIdxRef.current = idx;
        dirtyRef.current     = true;
      }
    };

    const onScroll = () => updateTarget();

    const onResize = () => { resizeCanvas(); drawFrame(frameIdxRef.current); };

    // ── Unified rAF loop ──────────────────────────────────────────────────
    const tick = () => {
      if (activeRef.current) {
        if (dirtyRef.current)     drawFrame(targetIdxRef.current);
        if (textDirtyRef.current) updateTextLayer(progressRef.current);
      }
      rafIdRef.current = requestAnimationFrame(tick);
    };

    // ── IntersectionObserver ──────────────────────────────────────────────
    const observer = new IntersectionObserver(
      ([entry]) => { activeRef.current = entry.isIntersecting; },
      { threshold: 0 },
    );
    observer.observe(section);

    window.addEventListener('scroll', onScroll,  { passive: true });
    window.addEventListener('resize', onResize,  { passive: true });

    resizeCanvas();
    updateTarget();   // seed canvas + text refs on mount (does NOT set userScrolledRef)
    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(rafIdRef.current);
      observer.disconnect();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="hero"
      style={{ height: '500vh' }}
      className="relative"
    >
      {/* Scene-01 entrance keyframe ─────────────────────────────────────────
          Defined here so only this component needs changing.
          The animation plays once on load; after the first scroll event the
          scroll system writes inline opacity/transform which cancels it and
          takes over.  blur-in is a single play so GPU cost is negligible.  */}
      {/* heroChildIn — staggered entrance for scene 01's individual text elements.
          Each child fades up independently; the scroll system owns the container's
          opacity/transform so this plays once on load and never conflicts.       */}
      <style>{`
        @keyframes heroChildIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
      `}</style>

      <div
        className="sticky top-0 h-screen w-full overflow-hidden bg-black"
        style={{ contain: 'paint style' }}
      >

        {/* Canvas ─────────────────────────────────────────────────────────── */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full opacity-90"
          style={{
            transform         : 'translateZ(0)',
            willChange        : 'transform',
            backfaceVisibility: 'hidden',
          }}
        />

        {/* Gradient overlay — dark ink tones match the site's #100c08 foundation */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(to bottom, rgba(16,12,8,0.55) 0%, rgba(16,12,8,0.08) 48%, rgba(16,12,8,0.65) 100%)',
            transform : 'translateZ(0)',
          }}
        />

        {/* Crimson atmospheric vignette — ambient brand glow from below */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 50% at 50% 100%, rgba(149,18,44,0.22) 0%, transparent 65%)',
            transform : 'translateZ(0)',
          }}
        />

        {/* Cinematic text scenes ───────────────────────────────────────────
            Four scenes are always in the DOM; opacity/transform driven by
            updateTextLayer via direct .style writes — no React re-render.
            Scene 01 uses a CSS animation for its initial entrance;
            all others start opacity:0 and are driven solely by scroll.  */}
        {SCENES.map((scene, i) => (
          <div
            key={i}
            ref={el => { sceneElsRef.current[i] = el; }}
            className={`absolute inset-0 flex px-10 md:px-20 py-16 md:py-24 pointer-events-none ${scene.flexCls}`}
            style={{
              // Scene 01 starts at opacity 1 — at progress=0 the scroll system
              // will compute opacity=1 (start:-0.10 puts us past the fade-in zone),
              // so there is no jump.  Its entrance is handled by heroChildIn on
              // the individual children below.
              // Scenes 02-04 start hidden; the scroll system reveals them.
              opacity   : i === 0 ? 1 : 0,
              transform : i === 0 ? 'translate(0,0)' : `translate(${scene.enterTx}px,${scene.enterTy}px)`,
              transition: 'opacity 0.06s linear, transform 0.06s linear',
              willChange: 'opacity, transform',
            }}
          >
            <div className="max-w-[17rem] md:max-w-sm text-center">

              {/* Scene index eyebrow
                  Scene 01: heroChildIn fades it up; other scenes: no animation
                  (their container is driven by the scroll system instead).   */}
              <p
                className="text-white/30 text-[9px] font-bold uppercase tracking-[0.25em] mb-3 font-sans select-none"
                style={i === 0 ? { animation: 'heroChildIn 0.55s ease-out 0.25s both' } : {}}
              >
                {String(i + 1).padStart(2, '0')}&nbsp;/&nbsp;{String(SCENES.length).padStart(2, '0')}
              </p>

              {/* Headline */}
              <h2
                className="font-serif font-black text-white leading-tight mb-2"
                style={{
                  fontSize  : 'clamp(1.65rem, 4vw, 2.6rem)',
                  textShadow: '0 2px 28px rgba(0,0,0,0.75)',
                  ...(i === 0 && { animation: 'heroChildIn 0.65s ease-out 0.45s both' }),
                }}
              >
                {scene.title}
              </h2>

              {/* Sub-text */}
              <p
                className="text-white/60 text-sm md:text-[0.95rem] leading-relaxed"
                style={{
                  textShadow: '0 1px 14px rgba(0,0,0,0.85)',
                  ...(i === 0 && { animation: 'heroChildIn 0.6s ease-out 0.65s both' }),
                }}
              >
                {scene.sub}
              </p>

              {/* CTA — scene 04 only */}
              {scene.hasCta && (
                <a
                  ref={ctaRef}
                  href="#booking"
                  className="cta-shine hero-cta-btn mt-6 inline-block text-white/90 px-8 py-3 rounded-full text-sm font-bold select-none"
                  style={{
                    pointerEvents  : 'none',
                    background     : 'rgba(16,12,8,0.68)',
                    border         : '1px solid rgba(255,255,255,0.13)',
                    backdropFilter : 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                  }}
                >
                  הזמינו תור עכשיו
                </a>
              )}
            </div>
          </div>
        ))}

        {/* Scroll cue ─────────────────────────────────────────────────────── */}
        <div
          aria-hidden="true"
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/35 pointer-events-none"
        >
          <span className="text-[10px] uppercase tracking-widest">גלול</span>
          <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

      </div>
    </section>
  );
}
