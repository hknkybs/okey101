import { useEffect, useState } from 'react';
import { serverNow } from '../net.ts';

/** Sunucu saatine göre kalan hamle süresi (çubuk veya saniye). */
export function TurnTimer({ deadline, total, bar }: { deadline: number; total: number; bar?: boolean }) {
  const [now, setNow] = useState(serverNow());
  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), 250);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, Math.ceil((deadline - now) / 1000));
  const pct = Math.max(0, Math.min(100, ((deadline - now) / (total * 1000)) * 100));
  if (bar)
    return (
      <div className="timer-bar" aria-hidden>
        <div style={{ width: `${pct}%` }} className={left <= 5 ? 'low' : ''} />
      </div>
    );
  return <span className={`timer ${left <= 5 ? 'low' : ''}`}>{left}s</span>;
}
