import type { ResolvedBlock, ResolvedSlide } from '@this-is-me/content';
import {
  clampPosition,
  directionBetween,
  down,
  goTo,
  next,
  positionFromUrl,
  positionToUrl,
  prev,
  up,
  type Position,
} from './navigation';

const block = (id: string, steps = 1): ResolvedBlock =>
  ({ id, layout: 'text', title: id, steps, bodyHtml: '', notesHtml: '' }) as ResolvedBlock;

const slide = (id: string, steps: number, children: ResolvedBlock[] = [], stepLinks?: (number | null)[]): ResolvedSlide => ({
  ...block(id, steps),
  children,
  stepLinks: stepLinks ?? Array.from({ length: steps }, () => (children.length ? 0 : null)),
});

// 0: hallo (1 step) · 1: weg (4 steps, dives at steps 2 and 3) · 2: heute (1 step, 2 dives) · 3: ende (1 step)
const deck = {
  slides: [
    slide('hallo', 1),
    slide('weg', 4, [block('a'), block('b', 2)], [null, null, 0, 1]),
    slide('heute', 1, [block('x'), block('y')]),
    slide('ende', 1),
  ],
};
const at = (slide: number, step = 0, sub: number | null = null, subStep = 0): Position => ({ slide, step, sub, subStep });

describe('next', () => {
  it('advances steps inside a slide, then the slide', () => {
    expect(next(deck, at(1, 0))).toEqual(at(1, 1));
    expect(next(deck, at(1, 3))).toEqual(at(2, 0));
    expect(next(deck, at(0))).toEqual(at(1, 0));
  });
  it('stays on the last step of the last slide', () => {
    expect(next(deck, at(3))).toEqual(at(3));
  });
  it('walks through the steps of a deep dive, then jumps to the next main slide', () => {
    expect(next(deck, at(1, 3, 1, 0))).toEqual(at(1, 3, 1, 1));
    expect(next(deck, at(1, 3, 1, 1))).toEqual(at(2, 0));
    expect(next(deck, at(1, 2, 0, 0))).toEqual(at(2, 0));
  });
});

describe('prev', () => {
  it('goes back one step, then to the previous slide on its last step', () => {
    expect(prev(deck, at(1, 2))).toEqual(at(1, 1));
    expect(prev(deck, at(2, 0))).toEqual(at(1, 3));
    expect(prev(deck, at(1, 0))).toEqual(at(0, 0));
  });
  it('stays on the first slide', () => {
    expect(prev(deck, at(0))).toEqual(at(0));
  });
  it('leaves a deep dive on the same step of the main slide', () => {
    expect(prev(deck, at(1, 2, 0, 0))).toEqual(at(1, 2));
    expect(prev(deck, at(1, 3, 1, 1))).toEqual(at(1, 3, 1, 0));
    expect(prev(deck, at(1, 3, 1, 0))).toEqual(at(1, 3));
  });
});

describe('down / up', () => {
  it('opens the deep dive linked to the current step', () => {
    expect(down(deck, at(1, 2))).toEqual(at(1, 2, 0, 0));
    expect(down(deck, at(1, 3))).toEqual(at(1, 3, 1, 0));
  });
  it('ignores steps without a link and slides without children', () => {
    expect(down(deck, at(1, 0))).toEqual(at(1, 0));
    expect(down(deck, at(0))).toEqual(at(0));
    expect(down(deck, at(3))).toEqual(at(3));
  });
  it('moves to the next deep dive and stops at the last one', () => {
    expect(down(deck, at(2, 0, 0))).toEqual(at(2, 0, 1, 0));
    expect(down(deck, at(2, 0, 1))).toEqual(at(2, 0, 1));
  });
  it('up returns to the same step of the main slide', () => {
    expect(up(deck, at(1, 2, 0))).toEqual(at(1, 2));
    expect(up(deck, at(1, 3, 0, 0))).toEqual(at(1, 3));
    expect(up(deck, at(1, 3, 1, 1))).toEqual(at(1, 3));
    expect(up(deck, at(2, 0, 1))).toEqual(at(2, 0));
    expect(up(deck, at(0))).toEqual(at(0));
  });
});

describe('goTo / clampPosition', () => {
  it('jumps to slide and step and clamps out-of-range values', () => {
    expect(goTo(deck, 1, 3)).toEqual(at(1, 3));
    expect(goTo(deck, 9, 9)).toEqual(at(3, 0));
    expect(goTo(deck, -2, -2)).toEqual(at(0, 0));
    expect(goTo(deck, 1, 99)).toEqual(at(1, 3));
  });
  it('drops unknown deep dives and clamps sub steps', () => {
    expect(clampPosition(deck, at(1, 2, 7))).toEqual(at(1, 2));
    expect(clampPosition(deck, at(1, 3, 1, 9))).toEqual(at(1, 3, 1, 1));
  });
});

describe('direction', () => {
  it('compares positions along the deck', () => {
    expect(directionBetween(at(0), at(1))).toBe(1);
    expect(directionBetween(at(2), at(1, 3))).toBe(-1);
    expect(directionBetween(at(1, 2), at(1, 2))).toBe(0);
    expect(directionBetween(at(1, 2), at(1, 2, 0))).toBe(1);
  });
});

describe('URL mapping', () => {
  it('parses slide, deep dive and steps and rejects unknown ids', () => {
    expect(positionFromUrl(deck, { slide: 'weg', s: '3' })).toEqual(at(1, 3));
    expect(positionFromUrl(deck, { slide: 'weg', sub: 'b', s: '3', ss: '1' })).toEqual(at(1, 3, 1, 1));
    expect(positionFromUrl(deck, { slide: 'weg', s: '99' })).toEqual(at(1, 3));
    expect(positionFromUrl(deck, { slide: 'nope' })).toBeNull();
    expect(positionFromUrl(deck, { slide: 'weg', sub: 'nope' })).toBeNull();
  });
  it('builds URLs that round-trip', () => {
    for (const pos of [at(0), at(1, 3), at(1, 3, 1, 1), at(2, 0, 1)]) {
      const { commands, queryParams } = positionToUrl(deck, pos);
      const parsed = positionFromUrl(deck, { slide: commands[0], sub: commands[1], ...queryParams });
      expect(parsed).toEqual(pos);
    }
  });
});
