import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { ResolvedBlock } from '../core/content.schema';
import { ClosingLayout } from '../slides/layouts/closing/closing.layout';
import { GalleryLayout } from '../slides/layouts/gallery/gallery.layout';
import { HeroLayout } from '../slides/layouts/hero/hero.layout';
import { JourneyLayout } from '../slides/layouts/journey/journey.layout';
import { ShowcaseLayout } from '../slides/layouts/showcase/showcase.layout';
import { StackLayout } from '../slides/layouts/stack/stack.layout';
import { TextLayout } from '../slides/layouts/text/text.layout';

/** Renders one block with the layout component matching its `layout`. */
@Component({
  selector: 'app-slide-host',
  imports: [HeroLayout, JourneyLayout, StackLayout, ShowcaseLayout, GalleryLayout, ClosingLayout, TextLayout],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.view-transition-name]': 'transitionName()',
    '[attr.data-layout]': 'block().layout',
  },
  template: `
    @let b = block();
    @switch (b.layout) {
      @case ('hero') {
        <app-hero-layout [block]="b" [step]="step()" />
      }
      @case ('journey') {
        <app-journey-layout [block]="b" [step]="step()" [interactive]="interactive()" (requestStep)="requestStep.emit($event)" />
      }
      @case ('stack') {
        <app-stack-layout [block]="b" [step]="step()" />
      }
      @case ('showcase') {
        <app-showcase-layout [block]="b" [step]="step()" />
      }
      @case ('gallery') {
        <app-gallery-layout [block]="b" [step]="step()" />
      }
      @case ('closing') {
        <app-closing-layout [block]="b" [step]="step()" />
      }
      @case ('text') {
        <app-text-layout [block]="b" [step]="step()" />
      }
    }
  `,
  styles: `
    :host {
      position: absolute;
      inset: 0;
      display: block;
    }
  `,
})
export class SlideHost {
  readonly block = input.required<ResolvedBlock>();
  readonly step = input(0);
  /** False in previews (presenter): no key handling, no click handling inside slides. */
  readonly interactive = input(true);
  /** Names the root for the hub ↔ slide morph; only one element per page may carry a name. */
  readonly named = input(true);
  readonly requestStep = output<number>();

  protected transitionName() {
    return this.named() ? `slide-${this.block().id}` : 'none';
  }
}
