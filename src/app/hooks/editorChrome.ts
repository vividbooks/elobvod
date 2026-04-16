import { useState, useEffect } from 'react';

/** Primární vstup je dotykový (tablet / telefon). */
export function useIsTouch() {
  const [isTouch, setIsTouch] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    const handler = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    if (mq.addEventListener) {
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mq as any).addListener(handler);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return () => (mq as any).removeListener(handler);
  }, []);
  return isTouch;
}

const TOOLBAR_H = 620;
const TOOLBAR_MARGIN = 24;

/** Měřítko levé palety podle výšky okna. */
export function useToolbarScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const compute = () => {
      const available = window.innerHeight - TOOLBAR_MARGIN;
      setScale(Math.min(1, Math.max(0.65, available / TOOLBAR_H)));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);
  return scale;
}
