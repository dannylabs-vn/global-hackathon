import { useLayoutEffect, useState } from 'react';

export function usePreviewScale() {
  const [scale, setScale] = useState(() => Math.min(1, window.innerWidth / 1440));
  useLayoutEffect(() => {
    const resize = () => setScale(Math.min(1, window.innerWidth / 1440));
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  return scale;
}
