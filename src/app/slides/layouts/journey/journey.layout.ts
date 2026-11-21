import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import type { ResolvedBlockOf } from '../../../core/content.schema';
import { useDeckKeys } from '../../../core/keyboard';
import {
  buildPath,
  cameraFor,
  easeInOutCubic,
  pointAtLength,
  worldHeight,
  type Pt,
  type PathModel,
} from './journey.geometry';

type Mode = 'station' | 'overview' | 'hut';

interface CardContent {
  year: string;
  title: string;
  tags: string[];
  /** Photo position the card relates to; the card sits on the opposite side of the stage. */
  at?: Pt;
}

const WALK_MS = 1100;
const ZOOM_STATION = 1.9;
const ZOOM_SUMMIT = 1.6;
const ZOOM_HUT = 2.2;

/**
 * Werdegang: a photo with a dashed path, stations as pins and a camera that travels from
 * station to station. Step 0 = overview, step k = station k. Behaviour follows
 * docs/prototypes/werdegang/index.html.
 */
@Component({
  selector: 'app-journey-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './journey.layout.html',
  styleUrl: './journey.layout.scss',
  host: {
    '[attr.data-no-advance]': "mode() !== 'station' ? '' : null",
  },
})
export class JourneyLayout {
  readonly block = input.required<ResolvedBlockOf<'journey'>>();
  readonly step = input(0);
  /** False in previews: no keyboard handling. */
  readonly interactive = input(true);
  readonly requestStep = output<number>();

  /** Local view mode (not part of navigation): zoomed-out overview or the hidden hut. */
  protected readonly mode = signal<Mode>('station');

  private readonly reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  protected readonly stations = computed(() => this.block().stations);
  protected readonly path = computed<PathModel>(() => buildPath(this.stations(), this.block().imageSize));
  protected readonly worldAspect = computed(() => {
    const [w, h] = this.block().imageSize;
    return `${w} / ${h}`;
  });
  protected readonly worldHeightPx = computed(() => worldHeight(this.block().imageSize));
  protected readonly viewBox = computed(() => `0 0 ${this.block().imageSize[0]} ${this.block().imageSize[1]}`);

  protected readonly camera = computed(() => {
    const { secret, imageSize } = this.block();
    const mode = this.mode();
    const step = this.step();
    if (mode === 'hut' && secret) return cameraFor(secret.at, ZOOM_HUT, imageSize);
    if (mode === 'overview' || step === 0) return cameraFor([50, 50], 1, imageSize);
    const station = this.stations()[step - 1];
    return cameraFor(station.at, station.summit ? ZOOM_SUMMIT : ZOOM_STATION, imageSize);
  });

  protected readonly cardContent = computed<CardContent>(() => {
    const { secret, title, kicker } = this.block();
    const stations = this.stations();
    const step = this.step();
    if (this.mode() === 'hut' && secret) return secret;
    if (this.mode() === 'overview') return { year: 'Gesamtbild', title, tags: ['Station anklicken', 'Z zurück'] };
    if (step === 0) return { year: kicker ?? 'Werdegang', title, tags: [`in ${stations.length} Etappen`] };
    return stations[step - 1];
  });

  /** The card shown on screen; lags behind `cardContent` by the cross-fade. */
  protected readonly card = signal<CardContent | null>(null);
  protected readonly cardSwapping = signal(false);
  protected readonly cardOnRight = computed(() => {
    const at = this.card()?.at;
    return !at || at[0] < 50;
  });

  protected readonly walker = signal<Pt>([0, 0]);
  protected readonly doneLength = signal(0);

  protected readonly toggleLabel = computed(() => (this.mode() === 'station' ? 'Gesamtbild (Z)' : 'Zurück zur Station (Z)'));
  protected readonly showToggle = computed(() => this.step() > 0 || this.mode() === 'hut');
  protected readonly dots = computed(() => Array.from({ length: this.block().steps }, (_, i) => i));

  private walkLength = 0;
  private walkerInitialised = false;
  private raf = 0;
  private swapTimer: ReturnType<typeof setTimeout> | undefined;
  private cardInitialised = false;

  constructor() {
    // Any navigation (step change) ends the overview / hut mode.
    effect(() => {
      this.step();
      untracked(() => this.mode.set('station'));
    });

    // Cross-fade the info card whenever its content changes.
    effect(() => {
      const next = this.cardContent();
      untracked(() => this.swapCard(next));
    });

    // The walker follows the path to the current station (stays put in overview / hut mode).
    effect(() => {
      const model = this.path();
      const step = this.step();
      const target = step === 0 ? 0 : model.stationLength[step - 1];
      untracked(() => this.walkTo(model, target));
    });

    useDeckKeys({ overview: () => this.interactive() && this.toggleOverview() });

    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => {
      cancelAnimationFrame(this.raf);
      clearTimeout(this.swapTimer);
    });
  }

  protected toggleOverview() {
    if (this.mode() !== 'station') this.mode.set('station');
    else if (this.step() > 0) this.mode.set('overview');
  }

  protected pick(step: number) {
    this.mode.set('station');
    this.requestStep.emit(step);
  }

  protected openHut() {
    this.mode.set('hut');
  }

  protected pct(value: number, total: number) {
    return (value / total) * 100;
  }

  private swapCard(next: CardContent) {
    clearTimeout(this.swapTimer);
    if (!this.cardInitialised || this.reducedMotion) {
      this.cardInitialised = true;
      this.card.set(next);
      this.cardSwapping.set(false);
      return;
    }
    this.cardSwapping.set(true);
    this.swapTimer = setTimeout(() => {
      this.card.set(next);
      this.cardSwapping.set(false);
    }, 250);
  }

  private walkTo(model: PathModel, target: number) {
    cancelAnimationFrame(this.raf);
    const apply = (length: number) => {
      this.walkLength = length;
      this.walker.set(pointAtLength(model, length));
      this.doneLength.set(length);
    };
    if (!this.walkerInitialised || this.reducedMotion) {
      this.walkerInitialised = true;
      apply(Math.min(target, model.total));
      return;
    }
    const from = Math.min(this.walkLength, model.total);
    const t0 = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / WALK_MS);
      apply(from + (target - from) * easeInOutCubic(t));
      if (t < 1) this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }
}
