import { useState, useEffect, useRef } from 'react';

export function useTimer(startTime) {
  const [elapsed, setElapsed] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!startTime) {
      setElapsed(0);
      return;
    }

    const tick = () => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [startTime]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return { elapsed, display };
}
