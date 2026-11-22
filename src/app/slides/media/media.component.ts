import { NgComponentOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, Type } from '@angular/core';
import type { Media } from '../../core/content.schema';

/**
 * Registry for `{ type: 'component', name }` media. Interactive components (skill graph, …)
 * register themselves here; an unknown name renders a visible hint instead of failing silently.
 */
export const MEDIA_COMPONENTS: Record<string, Type<unknown>> = {};

@Component({
  selector: 'app-media',
  imports: [NgComponentOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let m = media();
    @switch (m.type) {
      @case ('image') {
        <img
          [src]="m.src"
          [alt]="m.alt"
          [style.object-position]="m.focus ?? null"
          [attr.loading]="loading()"
          draggable="false"
        />
      }
      @case ('svg') {
        <img [src]="m.src" [alt]="m.alt" [attr.loading]="loading()" draggable="false" />
      }
      @case ('component') {
        @if (component(); as c) {
          <ng-container *ngComponentOutlet="c; inputs: m.inputs ?? {}" />
        } @else {
          <div class="unknown">Unbekannte Media-Komponente „{{ m.name }}"</div>
        }
      }
    }
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      user-select: none;
    }
    .unknown {
      display: grid;
      place-items: center;
      width: 100%;
      height: 100%;
      font: 500 28px/1.3 var(--font-sans);
      color: var(--muted);
      background: repeating-linear-gradient(
        45deg,
        #f3efe8,
        #f3efe8 16px,
        #ece7de 16px,
        #ece7de 32px
      );
    }
  `,
})
export class MediaComponent {
  readonly media = input.required<Media>();
  /** Eager loading for the first slide; everything else is lazy. */
  readonly eager = input(false);

  protected readonly loading = computed(() => (this.eager() ? 'eager' : 'lazy'));
  protected readonly component = computed(() => {
    const m = this.media();
    return m.type === 'component' ? (MEDIA_COMPONENTS[m.name] ?? null) : null;
  });
}
