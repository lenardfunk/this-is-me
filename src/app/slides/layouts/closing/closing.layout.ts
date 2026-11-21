import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Media, ResolvedBlockOf } from '../../../core/content.schema';
import { MediaComponent } from '../../media/media.component';

/** Default backdrop: the journey photo, focused on the summit. */
const DEFAULT_IMAGE: Media = {
  type: 'image',
  src: 'media/werdegang.jpg',
  alt: 'Landschaft mit Weg, Hügeln und einem Vulkan-Gipfel',
  focus: '40% 30%',
};

@Component({
  selector: 'app-closing-layout',
  imports: [MediaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './closing.layout.html',
  styleUrl: './closing.layout.scss',
})
export class ClosingLayout {
  readonly block = input.required<ResolvedBlockOf<'closing'>>();
  readonly step = input(0);

  protected readonly backdrop = computed(() => this.block().image ?? DEFAULT_IMAGE);
}
