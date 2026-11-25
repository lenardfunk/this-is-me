import type { ResolvedBlock, ResolvedSlide } from '@this-is-me/content';
import {
  axisBetween,
  clampPosition,
  directionBetween,
  down,
  filterJumpEntries,
  goTo,
  jumpEntries,
  jumpTree,
  next,
  parseJumpInput,
  positionFromUrl,
  positionToUrl,
  prev,
  up,
  visibleSteps,
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
  it('walks through the steps of a deep dive, then returns to its main slide on the same step', () => {
    expect(next(deck, at(1, 3, 1, 0))).toEqual(at(1, 3, 1, 1));
    expect(next(deck, at(1, 3, 1, 1))).toEqual(at(1, 3));
    expect(next(deck, at(1, 2, 0, 0))).toEqual(at(1, 2));
    expect(next(deck, at(2, 0, 0, 0))).toEqual(at(2, 0));
  });
  it('does not start the next step of the main slide when leaving a deep dive', () => {
    expect(next(deck, at(1, 2, 0, 0))).not.toEqual(at(1, 3));
    expect(next(deck, at(1, 2, 0, 0))).toEqual(at(1, 2));
    expect(next(deck, at(2, 0, 1, 0))).toEqual(at(2, 0));
  });
  it('continues along the main line after returning from a deep dive', () => {
    expect(next(deck, next(deck, at(1, 2, 0, 0)))).toEqual(at(1, 3));
    expect(next(deck, next(deck, at(1, 3, 1, 1)))).toEqual(at(2, 0));
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

describe('axis', () => {
  it('is vertical for opening, closing and switching deep dives', () => {
    expect(axisBetween(at(1, 2), at(1, 2, 0))).toBe('y');
    expect(axisBetween(at(1, 2, 0), at(1, 2))).toBe('y');
    expect(axisBetween(at(1, 2, 0), at(1, 2, 1))).toBe('y');
  });

  it('is horizontal for main-line moves and steps inside a deep dive', () => {
    expect(axisBetween(at(1), at(2))).toBe('x');
    expect(axisBetween(at(1, 0), at(1, 1))).toBe('x');
    expect(axisBetween(at(1, 0, 0, 0), at(1, 0, 0, 1))).toBe('x');
    expect(axisBetween(at(1, 2, 0), at(2))).toBe('x');
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

// ---- jump targets ----------------------------------------------------------------------------

const stepped = (partial: Record<string, unknown>) => partial as unknown as ResolvedBlock;

// 0: weg (journey: overview + 2 stations, station 2 opens dive "a") · 1: heute (stack, 2 steps, 3 layers)
// 2: hero with 3 steps that do not change visually · 3: ende (1 step)
const jumpDeck = {
  slides: [
    stepped({
      id: 'weg',
      layout: 'journey',
      title: 'Weg',
      steps: 3,
      stations: [
        { id: 's1', year: '2015', title: 'Ausbildung' },
        { id: 's2', year: '2018', title: 'Firma A' },
      ],
      bodyHtml: '',
      notesHtml: '',
      children: [],
      stepLinks: [null, null, 0],
    }),
    stepped({
      id: 'heute',
      layout: 'stack',
      title: 'Heute',
      steps: 2,
      layers: [{ label: 'Oberfläche' }, { label: 'Schnittstellen' }, { label: 'Daten' }],
      bodyHtml: '',
      notesHtml: '',
      children: [],
      stepLinks: [null, null],
    }),
    stepped({ id: 'hero', layout: 'hero', title: 'Hallo', steps: 3, bodyHtml: '', notesHtml: '', children: [], stepLinks: [null, null, null] }),
    stepped({ id: 'ende', layout: 'text', title: 'Ende', steps: 1, bodyHtml: '', notesHtml: '', children: [], stepLinks: [null] }),
  ] as ResolvedSlide[],
};
jumpDeck.slides[0].children = [stepped({ id: 'a-details', layout: 'text', title: 'Firma A Details', steps: 1, bodyHtml: '', notesHtml: '' })];

describe('visibleSteps', () => {
  it('labels journey steps with overview and stations', () => {
    expect(visibleSteps(jumpDeck.slides[0]).map((s) => s.label)).toEqual(['Überblick', '2015 · Ausbildung', '2018 · Firma A']);
  });
  it('labels stack steps with the layer revealed at that step', () => {
    expect(visibleSteps(jumpDeck.slides[1]).map((s) => s.label)).toEqual(['Schnittstellen', 'Daten']);
  });
  it('collapses layouts without step visuals to their title', () => {
    expect(visibleSteps(jumpDeck.slides[2])).toEqual([{ step: 0, label: 'Hallo' }]);
  });
});

describe('jumpTree', () => {
  it('links deep dives to the step that opens them', () => {
    const tree = jumpTree({ slides: [jumpDeck.slides[0]] });
    expect(tree[0].dives).toEqual([{ sub: 0, title: 'Firma A Details', linkStep: 2, steps: [{ step: 0, label: 'Firma A Details' }] }]);
  });
  it('defaults the link step to 0 when no step links to the dive', () => {
    const slide = { ...jumpDeck.slides[1], children: jumpDeck.slides[0].children, stepLinks: [null, null] } as ResolvedSlide;
    expect(jumpTree({ slides: [slide] })[0].dives[0].linkStep).toBe(0);
  });
});

describe('jumpEntries', () => {
  const entries = jumpEntries(jumpDeck);
  it('lists every visible step of a stepped slide with its breadcrumb', () => {
    expect(entries.filter((e) => e.path[0] === 'Weg').map((e) => [e.pos, e.label])).toEqual([
      [at(0, 0), 'Überblick'],
      [at(0, 1), '2015 · Ausbildung'],
      [at(0, 2), '2018 · Firma A'],
      [{ slide: 0, step: 2, sub: 0, subStep: 0 }, 'Firma A Details'],
    ]);
  });
  it('lists slides without visible steps once, at step 0', () => {
    expect(entries.filter((e) => e.label === 'Hallo')).toEqual([{ pos: at(2), path: [], label: 'Hallo' }]);
    expect(entries.filter((e) => e.label === 'Ende')).toEqual([{ pos: at(3), path: [], label: 'Ende' }]);
  });
  it('never offers the hidden steps of a non-stepped layout', () => {
    expect(entries.some((e) => e.pos.slide === 2 && e.pos.step > 0)).toBe(false);
  });
  it('labels a deep dive with several steps by dive and step', () => {
    const deckWithSteps = { slides: [{ ...jumpDeck.slides[0], children: [stepped({ id: 'd', layout: 'stack', title: 'D', steps: 2, layers: [{ label: 'L1' }, { label: 'L2' }], bodyHtml: '', notesHtml: '', children: [], stepLinks: [] })] }] as ResolvedSlide[] };
    deckWithSteps.slides[0].stepLinks = [0, null, null];
    const dive = jumpEntries(deckWithSteps).filter((e) => e.pos.sub !== null);
    expect(dive.map((e) => [e.pos, e.label])).toEqual([
      [{ slide: 0, step: 0, sub: 0, subStep: 0 }, 'D · L1'],
      [{ slide: 0, step: 0, sub: 0, subStep: 1 }, 'D · L2'],
    ]);
  });
});

describe('filterJumpEntries', () => {
  const entries = jumpEntries(jumpDeck);
  it('returns everything for an empty query', () => {
    expect(filterJumpEntries(entries, '   ')).toEqual(entries);
  });
  it('matches all terms case-insensitively against breadcrumb and label', () => {
    expect(filterJumpEntries(entries, 'FIRMA').map((e) => e.label)).toEqual(['2018 · Firma A', 'Firma A Details']);
    expect(filterJumpEntries(entries, 'weg firma').map((e) => e.label)).toEqual(['2018 · Firma A', 'Firma A Details']);
    expect(filterJumpEntries(entries, 'weg daten')).toEqual([]);
  });
});

describe('parseJumpInput', () => {
  it('reads slide and step, 1-based', () => {
    expect(parseJumpInput(jumpDeck, '2.2')).toEqual(at(1, 1));
    expect(parseJumpInput(jumpDeck, '2')).toEqual(at(1, 0));
    expect(parseJumpInput(jumpDeck, ' 1 : 3 ')).toEqual(at(0, 2));
  });
  it('clamps steps and rejects unknown slides and text', () => {
    expect(parseJumpInput(jumpDeck, '1.9')).toEqual(at(0, 2));
    expect(parseJumpInput(jumpDeck, '0')).toBeNull();
    expect(parseJumpInput(jumpDeck, '9')).toBeNull();
    expect(parseJumpInput(jumpDeck, 'firma')).toBeNull();
  });
});
