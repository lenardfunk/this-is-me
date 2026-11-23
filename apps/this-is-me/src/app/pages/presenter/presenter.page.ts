import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DeckStore } from '../../core/deck.store';
import { SlideHost, StageComponent, useDeckKeys } from '@this-is-me/slides';
import { SyncService } from '../../core/sync.service';
import { formatMmSs, timerState } from '../../core/timer';
import { DeckStatusComponent } from '../deck-status.component';

const HINT_KEY = 'this-is-me:presenter-hint-seen';

/** Presenter window: notes, timer, next-slide preview and deep dives. Synced via BroadcastChannel. */
@Component({
  selector: 'app-presenter-page',
  imports: [
    StageComponent,
    SlideHost,
    DeckStatusComponent,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'presenter-theme accent-scope',
    '[style.--accent]': 'store.deck()?.company?.accent ?? null',
  },
  templateUrl: './presenter.page.html',
  styleUrl: './presenter.page.scss',
})
export class PresenterPage {
  readonly deckId = input.required<string>({ alias: 'deck' });

  protected readonly store = inject(DeckStore);
  private readonly sync = inject(SyncService);

  protected readonly showHint = signal(readHintFlag());

  // ---- timer ---------------------------------------------------------------------------------
  private readonly elapsedBefore = signal(0);
  private readonly runningSince = signal<number | null>(null);
  private readonly now = signal(Date.now());
  protected readonly started = signal(false);
  protected readonly running = computed(() => this.runningSince() !== null);
  protected readonly elapsed = computed(() => {
    const since = this.runningSince();
    return this.elapsedBefore() + (since === null ? 0 : this.now() - since);
  });
  protected readonly elapsedLabel = computed(() => formatMmSs(this.elapsed()));
  protected readonly timerState = computed(() => timerState(this.elapsed(), this.store.deck()?.durationMinutes ?? 5));
  protected readonly timerRatio = computed(() =>
    Math.min(100, (this.elapsed() / ((this.store.deck()?.durationMinutes ?? 5) * 60_000)) * 100),
  );

  // ---- derived view state --------------------------------------------------------------------
  protected readonly slide = this.store.currentSlide;
  protected readonly block = this.store.currentBlock;
  protected readonly inDeepDive = computed(() => this.store.position().sub !== null);
  protected readonly stepLabel = computed(() => {
    const slide = this.slide();
    const block = this.block();
    if (!slide || !block) return '';
    const pos = this.store.position();
    if (pos.sub !== null) return `Vertiefung · ${block.title}${block.steps > 1 ? ` · Schritt ${pos.subStep + 1}/${block.steps}` : ''}`;
    return `${slide.title} · Schritt ${pos.step + 1}/${slide.steps}`;
  });
  protected readonly slideCounter = computed(() => `Folie ${this.store.position().slide + 1}/${this.store.deck()?.slides.length ?? 0}`);

  constructor() {
    effect(() => this.store.selectDeck(this.deckId()));
    this.sync.start('presenter');

    // The timer starts with the first navigation step (local or remote).
    let first = true;
    effect(() => {
      this.store.position();
      untracked(() => {
        if (first) {
          first = false;
          return;
        }
        if (!this.started()) this.startTimer();
      });
    });

    const tick = setInterval(() => this.now.set(Date.now()), 250);
    inject(DestroyRef).onDestroy(() => clearInterval(tick));

    useDeckKeys({
      next: () => this.store.next(),
      prev: () => this.store.prev(),
      down: () => this.store.down(),
      up: () => this.store.up(),
      blackout: () => this.store.toggleBlackout(),
    });
  }

  protected startTimer() {
    this.started.set(true);
    this.now.set(Date.now());
    this.runningSince.set(Date.now());
  }

  protected toggleTimer() {
    const since = this.runningSince();
    if (since === null) this.startTimer();
    else {
      this.elapsedBefore.update((e) => e + Date.now() - since);
      this.runningSince.set(null);
    }
  }

  protected resetTimer() {
    this.elapsedBefore.set(0);
    this.runningSince.set(null);
    this.started.set(false);
  }

  protected isCurrent(slideIndex: number) {
    return this.store.position().slide === slideIndex;
  }

  protected closeDeepDive() {
    const pos = this.store.position();
    if (pos.sub !== null) this.store.setPosition({ ...pos, sub: null, subStep: 0 });
  }

  protected isDeepDiveActive(index: number) {
    const pos = this.store.position();
    return pos.sub === index;
  }

  protected dismissHint() {
    this.showHint.set(false);
    try {
      localStorage.setItem(HINT_KEY, '1');
    } catch {
      /* storage unavailable: the hint simply shows again next time */
    }
  }

}

function readHintFlag(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) !== '1';
  } catch {
    return true;
  }
}
