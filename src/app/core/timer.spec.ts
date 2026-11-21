import { formatMmSs, timerState } from './timer';

describe('timerState', () => {
  it('switches to warn at 80 % and over at 100 % of the target', () => {
    expect(timerState(0, 5)).toBe('ok');
    expect(timerState(3 * 60_000 + 59_000, 5)).toBe('ok');
    expect(timerState(4 * 60_000, 5)).toBe('warn');
    expect(timerState(5 * 60_000 - 1, 5)).toBe('warn');
    expect(timerState(5 * 60_000, 5)).toBe('over');
    expect(timerState(9 * 60_000, 5)).toBe('over');
  });
});

describe('formatMmSs', () => {
  it('formats minutes and seconds', () => {
    expect(formatMmSs(0)).toBe('00:00');
    expect(formatMmSs(65_400)).toBe('01:05');
    expect(formatMmSs(12 * 60_000)).toBe('12:00');
    expect(formatMmSs(-5)).toBe('00:00');
  });
});
