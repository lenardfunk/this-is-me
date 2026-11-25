import { actionForEvent } from './keyboard';

const key = (k: string, mods: Partial<KeyboardEvent> = {}) =>
  ({ key: k, ctrlKey: false, metaKey: false, altKey: false, ...mods }) as KeyboardEvent;

describe('actionForEvent', () => {
  it('maps navigation keys', () => {
    expect(actionForEvent(key('ArrowRight'))).toBe('next');
    expect(actionForEvent(key(' '))).toBe('next');
    expect(actionForEvent(key('PageDown'))).toBe('next');
    expect(actionForEvent(key('ArrowLeft'))).toBe('prev');
    expect(actionForEvent(key('PageUp'))).toBe('prev');
    expect(actionForEvent(key('ArrowDown'))).toBe('down');
    expect(actionForEvent(key('ArrowUp'))).toBe('up');
    expect(actionForEvent(key('Escape'))).toBe('hub');
  });
  it('maps letters case-insensitively', () => {
    expect(actionForEvent(key('p'))).toBe('presenter');
    expect(actionForEvent(key('B'))).toBe('blackout');
    expect(actionForEvent(key('Z'))).toBe('overview');
    expect(actionForEvent(key('?'))).toBe('help');
    expect(actionForEvent(key('G'))).toBe('jump');
  });
  it('ignores modifier combinations and unknown keys', () => {
    expect(actionForEvent(key('p', { ctrlKey: true }))).toBeNull();
    expect(actionForEvent(key('ArrowRight', { altKey: true }))).toBeNull();
    expect(actionForEvent(key('x'))).toBeNull();
  });
});
