import { parseSyncMessage, presenterUrl } from './sync.service';

describe('parseSyncMessage', () => {
  it('accepts well-formed messages', () => {
    expect(parseSyncMessage({ kind: 'hello', from: 'a' })).toEqual({ kind: 'hello', from: 'a' });
    expect(parseSyncMessage({ kind: 'blackout', on: true, from: 'a' })).toEqual({ kind: 'blackout', on: true, from: 'a' });
    const pos = { slide: 1, step: 2, sub: null, subStep: 0 };
    expect(parseSyncMessage({ kind: 'position', pos, from: 'a' })).toEqual({ kind: 'position', pos, from: 'a' });
    expect(parseSyncMessage({ kind: 'position', pos: { ...pos, sub: 1 }, from: 'a' })).not.toBeNull();
  });

  it('rejects anything else', () => {
    expect(parseSyncMessage(null)).toBeNull();
    expect(parseSyncMessage('x')).toBeNull();
    expect(parseSyncMessage({ kind: 'hello' })).toBeNull();
    expect(parseSyncMessage({ kind: 'blackout', on: 'yes', from: 'a' })).toBeNull();
    expect(parseSyncMessage({ kind: 'position', pos: { slide: 1.5, step: 0, sub: null, subStep: 0 }, from: 'a' })).toBeNull();
    expect(parseSyncMessage({ kind: 'position', pos: { slide: 1, step: 0, sub: 'x', subStep: 0 }, from: 'a' })).toBeNull();
    expect(parseSyncMessage({ kind: 'unknown', from: 'a' })).toBeNull();
  });
});

describe('presenterUrl', () => {
  it('respects the base href (GitHub Pages sub path)', () => {
    expect(presenterUrl('default', 'https://x.github.io/this-is-me/')).toBe('https://x.github.io/this-is-me/presenter/default');
  });
});
