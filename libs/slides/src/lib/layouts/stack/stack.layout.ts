import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { ResolvedBlockOf } from '@this-is-me/content';

@Component({
  selector: 'app-stack-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stack.layout.html',
  styleUrl: './stack.layout.scss',
})
export class StackLayout {
  readonly block = input.required<ResolvedBlockOf<'stack'>>();
  readonly step = input(0);

  /** With several steps the layers appear one after another (top = UI first). */
  protected readonly visibleLayers = computed(() => {
    const { layers, steps } = this.block();
    if (steps <= 1) return layers.length;
    return Math.min(layers.length, Math.ceil(((this.step() + 1) / steps) * layers.length));
  });
}
