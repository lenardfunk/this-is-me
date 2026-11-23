export type TimerState = 'ok' | 'warn' | 'over';

/** Green until 80 % of the target time, yellow until 100 %, red afterwards. */
export function timerState(elapsedMs: number, targetMinutes: number): TimerState {
  const ratio = elapsedMs / (targetMinutes * 60_000);
  if (ratio >= 1) return 'over';
  if (ratio >= 0.8) return 'warn';
  return 'ok';
}

export function formatMmSs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
