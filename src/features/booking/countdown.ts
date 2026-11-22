import * as React from 'react';

/**
 * Hold countdown. The deadline is derived from the API's `remainingSeconds` at the moment the
 * response arrived (not from `expiresAt`), so a skewed client clock does not shorten the hold.
 */
export function holdDeadline(remainingSeconds: number, receivedAt: number = Date.now()): number {
  return receivedAt + Math.max(0, remainingSeconds) * 1000;
}

export function secondsLeft(deadline: number, now: number = Date.now()): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

/** "04:59" (mm:ss); hours are folded into minutes. */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

/** Earliest deadline among several holds (each may have been created at a different time). */
export function earliestDeadline(deadlines: readonly number[]): number | null {
  return deadlines.length === 0 ? null : Math.min(...deadlines);
}

/** Seconds left until `deadline`, ticking every second; null when there is no deadline. */
export function useCountdown(deadline: number | null): number | null {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (deadline === null) return;
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0); // resync right away when a new deadline arrives
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [deadline]);
  return deadline === null ? null : secondsLeft(deadline, now);
}
