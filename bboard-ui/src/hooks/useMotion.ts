import { useEffect, useRef, useState } from 'react';

/** True when the OS asks for reduced motion; updates live. */
export const useReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
};

/**
 * Animate a numeric display value toward `target` with an ease-out curve.
 * Purely visual — the caller keeps its own exact value for logic.
 */
export const useCountUp = (target: number, durationMs = 650): number => {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (reduced || !Number.isFinite(target)) {
      setValue(target);
      return;
    }
    fromRef.current = value;
    startRef.current = performance.now();

    const tick = (now: number) => {
      const p = Math.min(1, (now - startRef.current) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(fromRef.current + (target - fromRef.current) * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, durationMs, reduced]);

  return reduced ? target : value;
};

/**
 * Track the pointer position relative to an element, as 0..1 fractions, for a
 * spotlight / glow that follows the cursor. Returns a ref to attach and the
 * current {x, y} (defaults to the centre until the pointer moves).
 */
export const usePointerGlow = <T extends HTMLElement>() => {
  const ref = useRef<T | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0.5, y: 0.3 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        setPos({
          x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
          y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
        });
      });
    };
    el.addEventListener('pointermove', onMove);
    return () => {
      el.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  return { ref, pos };
};
