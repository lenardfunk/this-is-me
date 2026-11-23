import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { ResolvedBlockOf } from '@this-is-me/content';
import { MediaComponent } from '../../media/media.component';

@Component({
  selector: 'app-gallery-layout',
  imports: [MediaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gallery.layout.html',
  styleUrl: './gallery.layout.scss',
})
export class GalleryLayout {
  readonly block = input.required<ResolvedBlockOf<'gallery'>>();
  readonly step = input(0);

  /** Slight alternating tilt (±2°) so the photos feel pinned rather than gridded. */
  protected tilt(index: number) {
    return index % 2 === 0 ? -2 : 2;
  }
}
