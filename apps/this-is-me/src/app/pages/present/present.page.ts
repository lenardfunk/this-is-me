import { ChangeDetectionStrategy, Component, computed, effect, inject, input, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { DeckStore } from '../../core/deck.store';
import { SlideHost, StageComponent, useDeckKeys } from '@this-is-me/slides';
import { preloadMedia } from '../../core/preload';
import { SyncService } from '../../core/sync.service';
import { blockAt, positionFromUrl, stepOf, positionToUrl, samePosition, type Position } from '../../core/navigation';
import { DeckStatusComponent } from '../deck-status.component';

/** Presentation mode: one slide on the stage, position kept in sync with the URL. */
@Component({
  selector: 'app-present-page',
  imports: [StageComponent, SlideHost, DeckStatusComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.deck(); as deck) {
      <app-stage [accent]="deck.company?.accent" [blackout]="store.blackout()" (click)="onStageClick($event)">
        @if (shown(); as view) {
          <app-slide-host [block]="view.block" [step]="view.step" (requestStep)="onRequestStep($event)" />
        }
      </app-stage>
    } @else {
      <app-deck-status [status]="store.status()" />
    }
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      display: block;
      background: #111;
    }
  `,
})
export class PresentPage {
  // Route params and query params are bound to inputs (withComponentInputBinding).
  readonly deckId = input.required<string>({ alias: 'deck' });
  readonly slide = input<string>();
  readonly sub = input<string>();
  readonly s = input<string>();
  readonly ss = input<string>();

  protected readonly store = inject(DeckStore);
  private readonly router = inject(Router);
  private readonly sync = inject(SyncService);

  /** Position encoded in the URL; `null` if the URL points to an unknown slide. */
  private readonly urlPosition = computed(() => {
    const deck = this.store.deck();
    if (!deck) return undefined;
    return positionFromUrl(deck, { slide: this.slide(), sub: this.sub(), s: this.s(), ss: this.ss() });
  });

  /**
   * What is rendered follows the *route*, not the store. A navigation triggered by a key press only
   * reaches the route inside the view transition's update callback, so the old slide is still on
   * screen when the browser takes its "before" snapshot (otherwise the content would change first
   * and the transition would slide from B to B).
   */
  protected readonly shown = computed(() => {
    const deck = this.store.deck();
    if (!deck) return undefined;
    const pos = this.urlPosition() ?? this.store.position();
    const block = blockAt(deck, pos);
    return block ? { block, step: stepOf(pos) } : undefined;
  });

  constructor() {
    effect(() => this.store.selectDeck(this.deckId()));
    this.sync.start('presentation');

    // Warm the cache for whatever comes next.
    effect(() => {
      const next = this.store.nextBlock();
      if (next) preloadMedia(next);
    });

    // URL -> store (initial load, reload, browser back/forward)
    // Last position the URL was (or is about to be) set to. Compared against the store instead of
    // the live URL, because router navigations are async and can be superseded by quick key presses.
    let requested: Position | null = null;
    // Own navigations still in flight: URL changes they cause are not fed back into the store,
    // otherwise a slower, older navigation would rewind a quick sequence of key presses.
    let pending = 0;
    effect(() => {
      const pos = this.urlPosition();
      if (pos === undefined) return;
      if (pos === null) {
        void this.router.navigate(['/d', untracked(this.deckId)], { replaceUrl: true });
        return;
      }
      if (pending > 0) return;
      requested = pos;
      untracked(() => this.store.setPosition(pos));
    });

    // store -> URL (keys, clicks, sync from the presenter window)
    effect(() => {
      const pos = this.store.position();
      const deck = this.store.deck();
      if (!deck || !requested) return;
      untracked(() => {
        if (samePosition(requested!, pos)) return;
        requested = pos;
        const current = this.urlPosition();
        const { commands, queryParams } = positionToUrl(deck, pos);
        const sameSlide = current && current.slide === pos.slide && current.sub === pos.sub;
        pending++;
        void this.router
          .navigate(['/d', this.deckId(), ...commands], { queryParams, replaceUrl: !!sameSlide })
          .finally(() => pending--);
      });
    });

    useDeckKeys({
      next: () => this.store.next(),
      prev: () => this.store.prev(),
      down: () => this.store.down(),
      up: () => this.store.up(),
      hub: () => void this.router.navigate(['/d', this.deckId()]),
      blackout: () => this.store.toggleBlackout(),
      presenter: () => this.sync.openPresenter(),
    });
  }

  /** Click anywhere on the stage = next, except on interactive elements. */
  protected onStageClick(event: MouseEvent) {
    if ((event.target as HTMLElement).closest('button, a, input, [data-no-advance]')) return;
    this.store.next();
  }

  protected onRequestStep(step: number) {
    this.store.goTo(this.store.position().slide, step);
  }
}
