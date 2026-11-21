import { httpResource } from '@angular/common/http';
import { computed, Injectable, signal } from '@angular/core';
import type { ResolvedBlock, ResolvedDeck, ResolvedSlide } from './content.schema';
import * as nav from './navigation';
import { directionBetween, samePosition, START, type Position } from './navigation';

/** App-wide state: the loaded deck, the current position and the blackout flag. */
@Injectable({ providedIn: 'root' })
export class DeckStore {
  readonly deckId = signal<string | null>(null);
  readonly position = signal<Position>(START, { equal: samePosition });
  readonly blackout = signal(false);
  /** Direction of the last position change; drives the slide transition. */
  readonly direction = signal<1 | -1 | 0>(0);

  private readonly resource = httpResource<ResolvedDeck>(() => {
    const id = this.deckId();
    return id ? `generated/decks/${encodeURIComponent(id)}.json` : undefined;
  });

  readonly deck = computed<ResolvedDeck | undefined>(() =>
    this.resource.hasValue() ? this.resource.value() : undefined,
  );
  readonly status = computed<'idle' | 'loading' | 'ready' | 'error'>(() => {
    if (this.deckId() === null) return 'idle';
    if (this.resource.error()) return 'error';
    return this.deck() ? 'ready' : 'loading';
  });

  readonly currentSlide = computed<ResolvedSlide | undefined>(() => this.deck()?.slides[this.position().slide]);
  readonly currentBlock = computed<ResolvedBlock | undefined>(() => {
    const deck = this.deck();
    return deck ? nav.blockAt(deck, this.position()) : undefined;
  });
  /** Step to render inside `currentBlock`. */
  readonly currentStep = computed(() => nav.stepOf(this.position()));

  /** Where `next` would lead, or `null` at the very end. */
  readonly nextPosition = computed<Position | null>(() => {
    const deck = this.deck();
    if (!deck) return null;
    const target = nav.next(deck, this.position());
    return samePosition(target, this.position()) ? null : target;
  });
  readonly nextBlock = computed<ResolvedBlock | undefined>(() => {
    const deck = this.deck();
    const target = this.nextPosition();
    return deck && target ? nav.blockAt(deck, target) : undefined;
  });
  readonly nextStep = computed(() => {
    const target = this.nextPosition();
    return target ? nav.stepOf(target) : 0;
  });

  /** 0..1 over all main slides and their steps. */
  readonly progress = computed(() => {
    const deck = this.deck();
    if (!deck) return 0;
    const total = deck.slides.reduce((n, s) => n + s.steps, 0);
    const pos = this.position();
    const done = deck.slides.slice(0, pos.slide).reduce((n, s) => n + s.steps, 0) + pos.step + 1;
    return total ? done / total : 0;
  });

  selectDeck(id: string) {
    if (this.deckId() === id) return;
    this.deckId.set(id);
    this.position.set(START);
    this.blackout.set(false);
  }

  setPosition(pos: Position) {
    const deck = this.deck();
    const target = deck ? nav.clampPosition(deck, pos) : pos;
    const current = this.position();
    if (samePosition(target, current)) return;
    this.direction.set(directionBetween(current, target));
    this.position.set(target);
  }

  next() {
    this.move(nav.next);
  }
  prev() {
    this.move(nav.prev);
  }
  down() {
    this.move(nav.down);
  }
  up() {
    this.move(nav.up);
  }
  goTo(slide: number, step = 0) {
    const deck = this.deck();
    if (deck) this.setPosition(nav.goTo(deck, slide, step));
  }
  goToSub(sub: number) {
    const deck = this.deck();
    if (deck) this.setPosition(nav.goToSub(deck, this.position(), sub));
  }
  toggleBlackout() {
    this.blackout.update((b) => !b);
  }

  private move(fn: (deck: ResolvedDeck, pos: Position) => Position) {
    const deck = this.deck();
    if (deck) this.setPosition(fn(deck, this.position()));
  }
}
