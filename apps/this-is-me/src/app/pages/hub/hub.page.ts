import { FocusableOption, FocusKeyManager } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  viewChildren,
} from '@angular/core';
import { Router } from '@angular/router';
import type { ResolvedSlide } from '@this-is-me/content';
import { DeckStore } from '../../core/deck.store';
import { SyncService } from '../../core/sync.service';
import { buildPath, type Size, StageComponent } from '@this-is-me/slides';
import { DeckStatusComponent } from '../deck-status.component';

@Directive({ selector: '[appHubTile]' })
export class HubTile implements FocusableOption {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  focus() {
    this.el.focus();
  }
  isFocused() {
    return document.activeElement === this.el;
  }
}

interface Tile {
  slide: ResolvedSlide;
  index: number;
  label: string;
  icon?: string;
  size: 'md' | 'wide' | 'lg';
  image?: string;
  journey?: { image: string; viewBox: string; size: Size; d: string };
}

/** Bento overview: one tile per top-level slide; start and end point of every talk. */
@Component({
  selector: 'app-hub-page',
  imports: [StageComponent, HubTile, DeckStatusComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hub.page.html',
  styleUrl: './hub.page.scss',
})
export class HubPage {
  readonly deckId = input.required<string>({ alias: 'deck' });

  protected readonly store = inject(DeckStore);
  private readonly router = inject(Router);
  private readonly sync = inject(SyncService);
  private readonly tileRefs = viewChildren(HubTile);

  protected readonly heading = computed(() => {
    const first = this.store.deck()?.slides[0];
    return first?.layout === 'hero' ? first.title : (this.store.deck()?.title ?? '');
  });

  protected readonly tiles = computed<Tile[]>(() =>
    (this.store.deck()?.slides ?? []).map((slide, index) => {
      const tile = slide.tile ?? {};
      const journey =
        slide.layout === 'journey'
          ? {
              image: slide.image,
              size: slide.imageSize,
              viewBox: `0 0 ${slide.imageSize[0]} ${slide.imageSize[1]}`,
              d: buildPath(slide.stations, slide.imageSize).d,
            }
          : undefined;
      return {
        slide,
        index,
        label: tile.label ?? slide.title,
        icon: tile.icon,
        size: tile.size ?? 'md',
        image: tile.image,
        journey,
      };
    }),
  );

  constructor() {
    effect(() => this.store.selectDeck(this.deckId()));
    this.sync.start('presentation');

    const onKeydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      const tileFocused = document.activeElement?.hasAttribute('appHubTile') ?? false;
      const arrows = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
      if (arrows.includes(event.key)) {
        // → without a selected tile starts the talk; otherwise the arrows pick tiles.
        if (!tileFocused && event.key === 'ArrowRight') this.start();
        else this.moveFocus(event);
        event.preventDefault();
      } else if (event.key.toLowerCase() === 'p') {
        event.preventDefault();
        this.sync.openPresenter();
      } else if (!tileFocused && ['Enter', ' ', 'PageDown'].includes(event.key)) {
        event.preventDefault();
        this.start();
      }
    };
    window.addEventListener('keydown', onKeydown);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('keydown', onKeydown));
  }

  private moveFocus(event: KeyboardEvent) {
    const tiles = this.tileRefs();
    const manager = new FocusKeyManager([...tiles]).withWrap().withVerticalOrientation().withHorizontalOrientation('ltr');
    const focused = tiles.findIndex((t) => t.isFocused());
    if (focused >= 0) manager.updateActiveItem(focused);
    manager.onKeydown(event);
  }

  protected open(tile: Tile) {
    this.store.goTo(tile.index);
    void this.router.navigate(['/d', this.deckId(), tile.slide.id]);
  }

  protected start() {
    const first = this.tiles()[0];
    if (first) this.open(first);
  }
}
