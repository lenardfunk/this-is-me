import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import type { ResolvedBlockOf } from '@this-is-me/content';
import { MediaComponent } from '../../media/media.component';

@Component({
  selector: 'app-hero-layout',
  imports: [MediaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hero.layout.html',
  styleUrl: './hero.layout.scss',
})
export class HeroLayout {
  readonly block = input.required<ResolvedBlockOf<'hero'>>();
  readonly step = input(0);

  /** Easter egg: the portrait can be flipped to reveal a second photo. */
  protected readonly flipped = signal(false);

  protected flip() {
    this.flipped.update((f) => !f);
  }
}
