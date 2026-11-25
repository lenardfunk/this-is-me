import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { DiveEntry, Position, SlideEntry } from '../../core/navigation';

/**
 * Main slides as the primary row. The current slide opens below its label with its steps (a small
 * tree) and its deep dives (chips). Other slides show the same outline on hover or focus.
 */
@Component({
  selector: 'app-slide-strip',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './slide-strip.component.html',
  styleUrl: './slide-strip.component.scss',
})
export class SlideStripComponent {
  readonly tree = input.required<SlideEntry[]>();
  readonly position = input.required<Position>();
  readonly jump = output<Position>();

  protected isCurrent(entry: SlideEntry) {
    return this.position().slide === entry.slide;
  }

  protected isCurrentStep(slide: number, step: number) {
    const pos = this.position();
    return pos.slide === slide && pos.sub === null && pos.step === step;
  }

  protected isDoneStep(slide: number, step: number) {
    const pos = this.position();
    return pos.slide === slide && step < pos.step;
  }

  protected isActiveDive(slide: number, dive: DiveEntry) {
    const pos = this.position();
    return pos.slide === slide && pos.sub === dive.sub;
  }

  protected isDoneSlide(entry: SlideEntry) {
    return entry.slide < this.position().slide;
  }

  protected slidePos(slide: number): Position {
    return { slide, step: 0, sub: null, subStep: 0 };
  }

  protected stepPos(slide: number, step: number): Position {
    return { slide, step, sub: null, subStep: 0 };
  }

  protected divePos(slide: number, dive: DiveEntry, subStep = 0): Position {
    return { slide, step: dive.linkStep, sub: dive.sub, subStep };
  }

  /** Back from a deep dive to its main slide, on the step it was opened from. */
  protected backPos(): Position {
    return { ...this.position(), sub: null, subStep: 0 };
  }
}
