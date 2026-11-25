import type { ResolvedBlock, ResolvedDeck, ResolvedSlide } from '@this-is-me/content';

/**
 * Pure navigation functions for the 2D deck.
 *
 * - `slide`/`step`: main line (→ / ←). A slide has `steps` steps.
 * - `sub`/`subStep`: optional deep dive below the slide (↓ / ↑). `sub` indexes `slide.children`.
 *   While a deep dive is open, `step` keeps the step of the main slide it was opened from.
 */
export type Position = { slide: number; step: number; sub: number | null; subStep: number };

type Deck = Pick<ResolvedDeck, 'slides'>;

export const START: Position = { slide: 0, step: 0, sub: null, subStep: 0 };

const main = (slide: number, step = 0): Position => ({ slide, step, sub: null, subStep: 0 });

export function samePosition(a: Position, b: Position): boolean {
  return a.slide === b.slide && a.step === b.step && a.sub === b.sub && a.subStep === b.subStep;
}

export function slideAt(deck: Deck, pos: Position): ResolvedSlide | undefined {
  return deck.slides[pos.slide];
}

/** The block currently shown: the main slide or its open deep dive. */
export function blockAt(deck: Deck, pos: Position): ResolvedBlock | undefined {
  const slide = slideAt(deck, pos);
  if (!slide) return undefined;
  return pos.sub === null ? slide : slide.children[pos.sub];
}

/** The step to render for the block returned by `blockAt`. */
export function stepOf(pos: Position): number {
  return pos.sub === null ? pos.step : pos.subStep;
}

/**
 * Walks the steps of the current block. At the end of a deep dive, `→` returns to the main slide it
 * was opened from, on the same step (it does not advance that slide). From there the main line
 * continues as usual.
 */
export function next(deck: Deck, pos: Position): Position {
  const slide = slideAt(deck, pos);
  if (!slide) return pos;
  if (pos.sub === null) {
    if (pos.step < slide.steps - 1) return { ...pos, step: pos.step + 1 };
  } else {
    const child = slide.children[pos.sub];
    if (child && pos.subStep < child.steps - 1) return { ...pos, subStep: pos.subStep + 1 };
    return up(deck, pos);
  }
  return pos.slide < deck.slides.length - 1 ? main(pos.slide + 1) : pos;
}

export function prev(deck: Deck, pos: Position): Position {
  if (pos.sub !== null) {
    if (pos.subStep > 0) return { ...pos, subStep: pos.subStep - 1 };
    return main(pos.slide, pos.step);
  }
  if (pos.step > 0) return { ...pos, step: pos.step - 1 };
  if (pos.slide > 0) return main(pos.slide - 1, deck.slides[pos.slide - 1].steps - 1);
  return pos;
}

export function down(deck: Deck, pos: Position): Position {
  const slide = slideAt(deck, pos);
  if (!slide) return pos;
  if (pos.sub === null) {
    const link = slide.stepLinks[pos.step] ?? null;
    return link === null || !slide.children[link] ? pos : { ...pos, sub: link, subStep: 0 };
  }
  return pos.sub + 1 < slide.children.length ? { ...pos, sub: pos.sub + 1, subStep: 0 } : pos;
}

export function up(_deck: Deck, pos: Position): Position {
  if (pos.sub === null) return pos;
  // Always back to the main slide: sibling deep dives are unrelated to the one that was opened.
  return { ...pos, sub: null, subStep: 0 };
}

/** Jump to a main slide/step (hub tiles, journey station clicks). Out-of-range values are clamped. */
export function goTo(deck: Deck, slide: number, step = 0): Position {
  if (deck.slides.length === 0) return START;
  const s = Math.min(Math.max(0, Math.trunc(slide) || 0), deck.slides.length - 1);
  const maxStep = deck.slides[s].steps - 1;
  return main(s, Math.min(Math.max(0, Math.trunc(step) || 0), maxStep));
}

/** Jump straight into the deep dive `sub` of a slide (presenter list). */
export function goToSub(deck: Deck, pos: Position, sub: number): Position {
  const slide = slideAt(deck, pos);
  if (!slide || !slide.children[sub]) return pos;
  return { ...pos, sub, subStep: 0 };
}

/** Make an arbitrary (e.g. URL-derived or remote) position valid for this deck. */
export function clampPosition(deck: Deck, pos: Position): Position {
  const base = goTo(deck, pos.slide, pos.step);
  const slide = deck.slides[base.slide];
  if (!slide || pos.sub === null || !slide.children[pos.sub]) return base;
  const child = slide.children[pos.sub];
  return { ...base, sub: pos.sub, subStep: Math.min(Math.max(0, pos.subStep), child.steps - 1) };
}

/** 1 = moving forward through the deck, -1 = backward, 0 = same place. */
export function directionBetween(from: Position, to: Position): 1 | -1 | 0 {
  const key = (p: Position) => [p.slide, p.step, p.sub ?? -1, p.subStep];
  const a = key(from);
  const b = key(to);
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return b[i] > a[i] ? 1 : -1;
  return 0;
}

/**
 * Axis of a position change for the slide transition. `y` when the change only opens, closes or
 * switches a deep dive (same slide and step, different `sub`); everything else moves along `x`.
 */
export function axisBetween(from: Position, to: Position): 'x' | 'y' {
  return from.slide === to.slide && from.step === to.step && from.sub !== to.sub ? 'y' : 'x';
}

// ---- jump targets (presenter) ----------------------------------------------------------------
// Every position the presenter can jump to. Steps of layouts that do not change visually with
// their step are not offered: they would show the same slide.

/** Layouts whose visuals change with `step`. */
const STEPPED_LAYOUTS: ReadonlySet<ResolvedBlock['layout']> = new Set(['journey', 'stack']);

export interface StepEntry {
  /** Step index inside its block (main slide or deep dive). */
  step: number;
  label: string;
}

export interface DiveEntry {
  /** Index into `slide.children`. */
  sub: number;
  title: string;
  /** Step of the main slide the dive opens from (first matching `stepLinks` entry, else 0). */
  linkStep: number;
  steps: StepEntry[];
}

export interface SlideEntry {
  slide: number;
  title: string;
  steps: StepEntry[];
  dives: DiveEntry[];
}

/** One line of the jump palette: where it leads, its breadcrumb and its label. */
export interface JumpEntry {
  pos: Position;
  path: string[];
  label: string;
}

/** Steps of a block that are worth jumping to. Non-stepped layouts collapse to one entry. */
export function visibleSteps(block: ResolvedBlock): StepEntry[] {
  if (!STEPPED_LAYOUTS.has(block.layout)) return [{ step: 0, label: block.title }];
  return Array.from({ length: block.steps }, (_, step) => ({ step, label: stepLabel(block, step) }));
}

function stepLabel(block: ResolvedBlock, step: number): string {
  if (block.layout === 'journey') {
    const station = block.stations[step - 1];
    return station ? `${station.year} · ${station.title}` : 'Überblick';
  }
  if (block.layout === 'stack') {
    // Mirrors StackLayout.visibleLayers: the layer revealed at this step is the last visible one.
    const revealed = Math.min(block.layers.length, Math.ceil(((step + 1) / block.steps) * block.layers.length));
    return block.layers[revealed - 1]?.label ?? block.title;
  }
  return block.title;
}

/** The whole deck as a tree: main slides with their steps, and their deep dives with their steps. */
export function jumpTree(deck: Deck): SlideEntry[] {
  return deck.slides.map((slide, index) => ({
    slide: index,
    title: slide.title,
    steps: visibleSteps(slide),
    dives: slide.children.map((child, sub) => ({
      sub,
      title: child.title,
      linkStep: Math.max(0, slide.stepLinks.indexOf(sub)),
      steps: visibleSteps(child),
    })),
  }));
}

/** Flat list for the jump palette, in deck order. */
export function jumpEntries(deck: Deck): JumpEntry[] {
  return jumpTree(deck).flatMap((s) => {
    const own: JumpEntry[] =
      s.steps.length > 1
        ? s.steps.map((st) => ({ pos: main(s.slide, st.step), path: [s.title], label: st.label }))
        : [{ pos: main(s.slide), path: [], label: s.title }];
    const dives = s.dives.flatMap((d) =>
      d.steps.map((st) => ({
        pos: { slide: s.slide, step: d.linkStep, sub: d.sub, subStep: st.step },
        path: [s.title],
        label: d.steps.length > 1 ? `${d.title} · ${st.label}` : d.title,
      })),
    );
    return [...own, ...dives];
  });
}

/** Case-insensitive search: every whitespace-separated term must occur in the breadcrumb or label. */
export function filterJumpEntries(entries: JumpEntry[], query: string): JumpEntry[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return entries;
  return entries.filter((e) => {
    const haystack = [...e.path, e.label].join(' ').toLowerCase();
    return terms.every((t) => haystack.includes(t));
  });
}

/**
 * Numeric jump: `3` = slide 3, `3.2` = slide 3, step 2. Both are 1-based, as in the presenter's
 * "Folie 3/7". Returns `null` if the text is not a numeric jump or the slide does not exist.
 */
export function parseJumpInput(deck: Deck, text: string): Position | null {
  const match = /^\s*(\d+)(?:\s*[.,:]\s*(\d+))?\s*$/.exec(text);
  if (!match) return null;
  const slide = Number(match[1]) - 1;
  if (slide < 0 || slide >= deck.slides.length) return null;
  return goTo(deck, slide, match[2] ? Number(match[2]) - 1 : 0);
}

// ---- URL mapping -----------------------------------------------------------------------------
// /d/:deck/:slide[/:sub]?s=<step>&ss=<subStep>   (slide/sub are block ids)

export interface UrlPosition {
  slide?: string;
  sub?: string;
  s?: string;
  ss?: string;
}

export function positionFromUrl(deck: Deck & { slides: ResolvedSlide[] }, url: UrlPosition): Position | null {
  const slide = deck.slides.findIndex((s) => s.id === url.slide);
  if (slide === -1) return null;
  const sub = url.sub ? deck.slides[slide].children.findIndex((c) => c.id === url.sub) : null;
  if (sub === -1) return null;
  const int = (v?: string) => (v !== undefined && /^\d+$/.test(v) ? Number(v) : 0);
  return clampPosition(deck, { slide, step: int(url.s), sub, subStep: int(url.ss) });
}

export function positionToUrl(deck: Deck, pos: Position): { commands: string[]; queryParams: Record<string, string> } {
  const slide = deck.slides[pos.slide];
  const commands = [slide.id];
  const queryParams: Record<string, string> = {};
  if (pos.step > 0) queryParams['s'] = String(pos.step);
  if (pos.sub !== null) {
    commands.push(slide.children[pos.sub].id);
    if (pos.subStep > 0) queryParams['ss'] = String(pos.subStep);
  }
  return { commands, queryParams };
}
