import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { ResolvedBlockOf } from '@this-is-me/content';
import { MediaComponent } from '../../media/media.component';

@Component({
  selector: 'app-showcase-layout',
  imports: [MediaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './showcase.layout.html',
  styleUrl: './showcase.layout.scss',
})
export class ShowcaseLayout {
  readonly block = input.required<ResolvedBlockOf<'showcase'>>();
  readonly step = input(0);
}
