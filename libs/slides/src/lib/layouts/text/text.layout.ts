import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { ResolvedBlockOf } from '@this-is-me/content';

@Component({
  selector: 'app-text-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './text.layout.html',
  styleUrl: './text.layout.scss',
})
export class TextLayout {
  readonly block = input.required<ResolvedBlockOf<'text'>>();
  readonly step = input(0);
}
