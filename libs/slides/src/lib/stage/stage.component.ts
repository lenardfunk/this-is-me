import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  signal,
} from '@angular/core';

export const CANVAS_WIDTH = 1600;
export const CANVAS_HEIGHT = 900;

/**
 * Letterboxed full-size stage with a fixed 1600×900 design canvas that is scaled as a whole.
 * All slide/hub content is laid out in canvas pixels inside `<ng-content />`.
 */
@Component({
  selector: 'app-stage',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'accent-scope',
    '[style.--accent]': 'accent() ?? null',
    '[style.--stage-scale]': 'scale()',
  },
  template: `
    <div
      class="canvas"
      [style.width.px]="width"
      [style.height.px]="height"
      [style.transform]="'translate(-50%, -50%) scale(' + scale() + ')'"
    >
      <ng-content />
    </div>
    @if (blackout()) {
      <div class="blackout" aria-hidden="true"></div>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #111;
      container-type: normal;
    }
    .canvas {
      position: absolute;
      left: 50%;
      top: 50%;
      transform-origin: center center;
      overflow: hidden;
      background: var(--bg);
      color: var(--ink);
    }
    .blackout {
      position: absolute;
      inset: 0;
      background: #000;
      z-index: 10;
    }
  `,
})
export class StageComponent {
  readonly accent = input<string | undefined>();
  readonly blackout = input(false);

  protected readonly width = CANVAS_WIDTH;
  protected readonly height = CANVAS_HEIGHT;
  protected readonly scale = signal(1);

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    const update = () => {
      const { width, height } = host.getBoundingClientRect();
      if (width && height) this.scale.set(Math.min(width / CANVAS_WIDTH, height / CANVAS_HEIGHT));
    };
    afterNextRender(() => {
      update();
      const observer = new ResizeObserver(update);
      observer.observe(host);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
