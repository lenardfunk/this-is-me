import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';

interface MapStation {
  id: string;
  title: string;
  at?: readonly number[];
  via?: readonly (readonly number[])[];
  summit?: boolean;
}

export interface MapPick {
  /** `at:<index>`, `via:<index>` or `secret` */
  target: string;
  point: [number, number];
}

/**
 * The journey photo with stations, waypoints and the path between them. A click on the photo
 * places the selected target (a station, a new waypoint before a station, or the hidden station).
 */
@Component({
  selector: 'sc-journey-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bar">
      <label for="map-target">Klick ins Foto setzt</label>
      <select id="map-target" class="input" [value]="target()" (change)="target.set($any($event.target).value)">
        @for (s of stations(); track $index) {
          <option [value]="'at:' + $index" [selected]="target() === 'at:' + $index">Station {{ $index + 1 }} „{{ s.title }}“</option>
          @if ($index > 0) {
            <option [value]="'via:' + $index" [selected]="target() === 'via:' + $index">↳ Zwischenpunkt vor Station {{ $index + 1 }} anhängen</option>
          }
        }
        @if (secret()) {
          <option value="secret" [selected]="target() === 'secret'">Versteckte Station (Hütte)</option>
        }
      </select>
    </div>
    <div class="map" [style.aspect-ratio]="ratio()" (click)="pick($event)">
      <img [src]="image()" alt="" draggable="false" />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <polyline [attr.points]="pathPoints()" />
      </svg>
      @for (p of waypoints(); track $index) {
        <span class="via" [style.left.%]="p[0]" [style.top.%]="p[1]"></span>
      }
      @for (s of stations(); track $index) {
        @if (s.at) {
          <button
            type="button"
            class="marker"
            [class.selected]="target() === 'at:' + $index || target() === 'via:' + $index"
            [class.summit]="s.summit"
            [style.left.%]="s.at[0]"
            [style.top.%]="s.at[1]"
            [title]="s.title"
            (click)="select($event, 'at:' + $index)"
          >
            {{ $index + 1 }}
          </button>
        }
      }
      @if (secret(); as h) {
        <button
          type="button"
          class="marker secret"
          [class.selected]="target() === 'secret'"
          [style.left.%]="h[0]"
          [style.top.%]="h[1]"
          title="Versteckte Station"
          (click)="select($event, 'secret')"
        >
          <span class="icon">cottage</span>
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      margin: 0 0 16px;
    }
    .bar {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
      font-size: 13px;
      font-weight: 600;
      color: var(--muted);
      white-space: nowrap;
      select {
        min-height: 32px;
        padding: 4px 8px;
        font-weight: 400;
        color: var(--ink);
      }
    }
    .map {
      position: relative;
      border-radius: 12px;
      overflow: hidden;
      cursor: crosshair;
      background: var(--sc-panel);
      img,
      svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        user-select: none;
      }
      img {
        object-fit: fill;
      }
    }
    polyline {
      fill: none;
      stroke: white;
      stroke-width: 0.5;
      stroke-dasharray: 1.2 1;
      vector-effect: non-scaling-stroke;
      stroke-width: 2.5px;
      filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.6));
    }
    .marker,
    .via {
      position: absolute;
      transform: translate(-50%, -50%);
    }
    .via {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: white;
      border: 2px solid var(--accent);
      pointer-events: none;
    }
    .marker {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      border: 2px solid white;
      background: var(--accent);
      color: white;
      font: 700 12px/1 var(--font-sans);
      display: grid;
      place-items: center;
      padding: 0;
      cursor: pointer;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
      &.summit {
        background: var(--accent-ink);
      }
      &.secret {
        background: #6b5a3e;
        .icon {
          font-size: 15px;
        }
      }
      &.selected {
        outline: 3px solid #ffd54a;
        outline-offset: 1px;
      }
    }
  `,
})
export class JourneyMapComponent {
  readonly image = input.required<string>();
  readonly imageSize = input<readonly number[] | undefined>();
  readonly stations = input.required<readonly MapStation[]>();
  readonly secret = input<readonly number[] | undefined>();
  readonly target = model('at:0');
  readonly picked = output<MapPick>();

  protected readonly ratio = computed(() => {
    const [w, h] = this.imageSize() ?? [];
    return w && h ? `${w} / ${h}` : '3 / 2';
  });

  private readonly route = computed(() =>
    this.stations().flatMap((s, i) => [...(i > 0 ? (s.via ?? []) : []), ...(s.at ? [s.at] : [])]),
  );
  protected readonly pathPoints = computed(() =>
    this.route()
      .map((p) => `${p[0]},${p[1]}`)
      .join(' '),
  );
  protected readonly waypoints = computed(() => this.stations().flatMap((s, i) => (i > 0 ? (s.via ?? []) : [])));

  protected select(event: Event, target: string) {
    event.stopPropagation();
    this.target.set(target);
  }

  protected pick(event: MouseEvent) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const round = (v: number) => Math.round(Math.min(100, Math.max(0, v)) * 2) / 2;
    const point: [number, number] = [
      round(((event.clientX - rect.left) / rect.width) * 100),
      round(((event.clientY - rect.top) / rect.height) * 100),
    ];
    this.picked.emit({ target: this.target(), point });
  }
}
