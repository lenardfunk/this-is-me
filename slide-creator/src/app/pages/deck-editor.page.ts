import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { ResolvedSlide, SlideRef } from '../../../../src/app/core/content.schema';
import type { BlockDraft, BlockInfo, BlockLocation, DeckDetails, DeckFile, DeckSummary, SaveResult } from '../../../shared/api.types';
import { ApiService, problemsOf } from '../api.service';
import { AddSlideComponent, type AddSlideRequest } from '../editor/add-slide.component';
import { BlockEditorComponent } from '../editor/block-editor.component';
import { MediaDatalist, MediaPathField, NumberField, TextField } from '../editor/fields';
import { PreviewComponent } from '../editor/preview.component';
import {
  blockTemplate,
  childrenOf,
  layoutInfo,
  locationLabel,
  makeRef,
  move,
  sameLocation,
  setIn,
  slideIdOf,
} from '../model';

const DECK = '@deck';
const ADD = '@add';
const PRESENTATION_APP = 'http://localhost:4200';

const json = (v: unknown) => JSON.stringify(v ?? null);

@Component({
  selector: 'sc-deck-editor-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, BlockEditorComponent, PreviewComponent, AddSlideComponent, TextField, NumberField, MediaPathField, MediaDatalist],
  templateUrl: './deck-editor.page.html',
  styleUrl: './deck-editor.page.scss',
  host: {
    '(window:keydown)': 'onKeydown($event)',
    '(window:beforeunload)': 'onBeforeUnload($event)',
    '[style.--accent]': 'accent() ?? null',
    class: 'accent-scope',
  },
})
export class DeckEditorPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  /** Route parameter `:deckId`. */
  readonly deckId = input.required<string>();
  /** Query parameter `?slide=` (selected block). */
  readonly slide = input<string>();

  protected readonly DECK = DECK;
  protected readonly ADD = ADD;

  protected readonly details = signal<DeckDetails | null>(null);
  protected readonly decks = signal<DeckSummary[]>([]);
  protected readonly deckDraft = signal<DeckFile | null>(null);
  protected readonly blockDrafts = signal<Record<string, BlockDraft>>({});
  protected readonly blockOriginals = signal<Record<string, BlockDraft>>({});
  protected readonly selected = signal<string>(DECK);
  protected readonly addParent = signal('');

  protected readonly loadProblems = signal<string[]>([]);
  protected readonly saveProblems = signal<string[]>([]);
  protected readonly buildResult = signal<SaveResult | null>(null);
  protected readonly saving = signal(false);
  protected readonly savedAt = signal<Date | null>(null);

  protected readonly preview = signal<ResolvedSlide | null>(null);
  protected readonly previewAccent = signal<string | undefined>(undefined);
  protected readonly previewProblems = signal<string[]>([]);

  // ---- derived state -----------------------------------------------------------------------

  protected readonly isChild = computed(() => !!this.deckDraft()?.extends);
  protected readonly ownSlides = computed(() => !!this.deckDraft()?.slides);
  protected readonly slides = computed<SlideRef[]>(
    () => this.deckDraft()?.slides ?? this.details()?.parentSlides ?? [],
  );
  protected readonly mainIds = computed(() => this.slides().map(slideIdOf));
  protected readonly usedIds = computed(() => this.slides().flatMap((r) => [slideIdOf(r), ...childrenOf(r)]));
  protected readonly blockInfo = computed(() => new Map((this.details()?.blocks ?? []).map((b) => [b.id, b])));
  protected readonly accent = computed(() => this.previewAccent() ?? this.deckDraft()?.company?.accent);

  protected readonly selectedDraft = computed(() => this.blockDrafts()[this.selected()]);
  protected readonly selectedInfo = computed(() => this.blockInfo().get(this.selected()));
  protected readonly selectedParent = computed(
    () => this.slides().find((r) => childrenOf(r).includes(this.selected())),
  );
  protected readonly selectedChildren = computed(() => {
    const ref = this.slides().find((r) => slideIdOf(r) === this.selected());
    return ref ? childrenOf(ref) : [];
  });
  /** Block shown in the preview: the selected one, else the first slide. */
  protected readonly previewId = computed(() =>
    this.selected() !== DECK && this.selected() !== ADD ? this.selected() : this.mainIds()[0],
  );
  protected readonly presentUrl = computed(() => {
    const id = this.previewId();
    if (!id) return undefined;
    const parent = this.slides().find((r) => childrenOf(r).includes(id));
    const path = parent ? `${slideIdOf(parent)}/${id}` : id;
    return `${PRESENTATION_APP}/d/${this.deckId()}/${path}`;
  });

  protected readonly deckDirty = computed(() => {
    const saved = this.details()?.deck;
    return !!saved && json(saved) !== json(this.deckDraft());
  });
  protected readonly dirtyBlocks = computed(() => {
    const originals = this.blockOriginals();
    return Object.entries(this.blockDrafts())
      .filter(([id, draft]) => json(draft) !== json(originals[id]))
      .map(([id]) => id);
  });
  protected readonly dirtyCount = computed(() => this.dirtyBlocks().length + (this.deckDirty() ? 1 : 0));

  constructor() {
    // (Re)load whenever the route's deck changes.
    effect(() => {
      const id = this.deckId();
      untracked(() => this.load(id));
    });
    // Selection from the URL (?slide=…).
    effect(() => {
      const slide = this.slide();
      untracked(() => this.select(slide ?? DECK, false));
    });
    this.setupPreview();
    void this.api.refreshMedia().catch(() => undefined);
  }

  // ---- loading -----------------------------------------------------------------------------

  private async load(id: string) {
    this.details.set(null);
    this.deckDraft.set(null);
    this.blockDrafts.set({});
    this.blockOriginals.set({});
    this.preview.set(null);
    this.previewAccent.set(undefined);
    try {
      const [details, decks] = await Promise.all([this.api.deck(id), this.api.decks()]);
      this.details.set(details);
      this.decks.set(decks);
      this.deckDraft.set(structuredClone(details.deck));
      this.loadProblems.set([]);
      this.buildResult.set(await this.api.status());
      const selected = this.selected();
      if (selected !== DECK && selected !== ADD) await this.ensureBlock(selected);
    } catch (e) {
      this.loadProblems.set(problemsOf(e));
    }
  }

  private async reloadDetails() {
    const details = await this.api.deck(this.deckId());
    this.details.set(details);
  }

  /** Default save target: decks that extend another deck get their own copy of foreign blocks. */
  private defaultLocation(source: BlockLocation): BlockLocation {
    if (sameLocation(source, { kind: 'deck', deck: this.deckId() })) return source;
    return this.isChild() ? { kind: 'deck', deck: this.deckId() } : source;
  }

  private async ensureBlock(id: string) {
    if (this.blockDrafts()[id]) return;
    try {
      const block = await this.api.block(this.deckId(), id);
      const draft = { ...block, location: this.defaultLocation(block.location) };
      this.blockOriginals.update((o) => ({ ...o, [id]: draft }));
      this.blockDrafts.update((d) => ({ ...d, [id]: draft }));
    } catch (e) {
      this.saveProblems.set(problemsOf(e));
    }
  }

  protected select(id: string, updateUrl = true) {
    this.selected.set(id);
    if (id !== DECK && id !== ADD && this.details()) void this.ensureBlock(id);
    if (updateUrl) {
      void this.router.navigate([], {
        queryParams: { slide: id === DECK || id === ADD ? null : id },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  protected openAdd(parent = '') {
    this.addParent.set(parent);
    this.select(ADD);
  }

  // ---- display helpers ---------------------------------------------------------------------

  protected readonly titleOf = (id: string): string => {
    const draft = this.blockDrafts()[id];
    return String(draft?.frontmatter['title'] ?? this.blockInfo().get(id)?.title ?? id);
  };

  protected iconOf(id: string) {
    const layout = String(this.blockDrafts()[id]?.frontmatter['layout'] ?? this.blockInfo().get(id)?.layout ?? '');
    return layoutInfo(layout)?.icon ?? 'help';
  }

  protected sourceOf(info: BlockInfo | undefined): { label: string; own: boolean } | null {
    if (!info) return { label: 'fehlt!', own: false };
    const own = sameLocation(info.location, { kind: 'deck', deck: this.deckId() });
    if (own && !info.shadows.length) return this.isChild() ? { label: 'eigen', own: true } : null;
    if (own) return { label: 'ersetzt', own: true };
    return { label: locationLabel(info.location, this.deckId()), own: false };
  }

  protected where(location: BlockLocation) {
    return locationLabel(location, this.deckId());
  }

  protected isDirty(id: string) {
    return this.dirtyBlocks().includes(id);
  }

  // ---- deck edits --------------------------------------------------------------------------

  protected setDeck(path: (string | number)[], value: unknown) {
    this.deckDraft.update((d) => d && setIn(d, path, value));
  }

  protected setCompany(key: 'name' | 'accent' | 'logo', value: string | undefined) {
    this.deckDraft.update((d) => {
      if (!d) return d;
      const company = setIn(d.company ?? {}, [key], value || undefined);
      return setIn(d, ['company'], Object.keys(company).length ? company : undefined);
    });
  }

  private setSlides(slides: SlideRef[] | undefined) {
    this.setDeck(['slides'], slides);
  }

  protected customizeSlides() {
    this.setSlides(structuredClone(this.slides()));
  }

  protected inheritSlides() {
    if (confirm('Eigene Folienliste verwerfen und wieder die Liste des Basis-Decks verwenden?')) this.setSlides(undefined);
  }

  protected moveSlide(index: number, by: number) {
    this.setSlides(move(this.slides(), index, index + by));
  }

  protected removeSlide(index: number) {
    const ref = this.slides()[index];
    const children = childrenOf(ref);
    const msg = children.length
      ? `„${this.titleOf(slideIdOf(ref))}“ und ${children.length} Vertiefung(en) aus dem Deck entfernen? Die Dateien bleiben erhalten.`
      : `„${this.titleOf(slideIdOf(ref))}“ aus dem Deck entfernen? Die Datei bleibt erhalten.`;
    if (!confirm(msg)) return;
    this.setSlides(this.slides().filter((_, i) => i !== index));
    if ([slideIdOf(ref), ...children].includes(this.selected())) this.select(DECK);
  }

  protected moveChild(index: number, child: number, by: number) {
    const ref = this.slides()[index];
    const children = move(childrenOf(ref), child, child + by);
    this.setSlides(this.slides().map((r, i) => (i === index ? makeRef(slideIdOf(r), children) : r)));
  }

  protected removeChild(index: number, child: number) {
    const ref = this.slides()[index];
    const children = childrenOf(ref).filter((_, i) => i !== child);
    this.setSlides(this.slides().map((r, i) => (i === index ? makeRef(slideIdOf(r), children) : r)));
  }

  private insertSlide(id: string, parent?: string) {
    const slides = this.slides();
    if (!parent) this.setSlides([...slides, id]);
    else {
      this.setSlides(slides.map((r) => (slideIdOf(r) === parent ? makeRef(parent, [...childrenOf(r), id]) : r)));
    }
  }

  protected setOverride(id: string, value: Record<string, unknown> | undefined) {
    this.deckDraft.update((d) => {
      if (!d) return d;
      const overrides = setIn(d.overrides ?? {}, [id], value);
      return setIn(d, ['overrides'], Object.keys(overrides).length ? overrides : undefined);
    });
  }

  protected overrideOf(id: string) {
    return this.deckDraft()?.overrides?.[id] as Record<string, unknown> | undefined;
  }

  // ---- block edits -------------------------------------------------------------------------

  protected updateDraft(id: string, draft: BlockDraft) {
    this.blockDrafts.update((d) => ({ ...d, [id]: draft }));
  }

  protected setDraftLocation(id: string, value: string) {
    const draft = this.blockDrafts()[id];
    if (!draft) return;
    const location: BlockLocation = value === 'library' ? { kind: 'library' } : { kind: 'deck', deck: value };
    this.updateDraft(id, { ...draft, location });
  }

  protected readonly companyHint = 'Ersetzt {{company.name}} in allen Folien';
  protected readonly idOf = slideIdOf;
  protected readonly kidsOf = childrenOf;
  protected readonly sameAsSource = sameLocation;

  /** True if the block file currently in use lives in this deck's own folder. */
  protected ownsFile(info: BlockInfo | undefined) {
    return !!info && sameLocation(info.location, { kind: 'deck', deck: this.deckId() });
  }

  protected choiceLabel(choice: BlockLocation, info: BlockInfo | undefined) {
    const own = sameLocation(choice, { kind: 'deck', deck: this.deckId() });
    if (!own) return `${this.where(choice)} (Original)`;
    return info && sameLocation(info.location, choice) ? 'diesem Deck' : 'diesem Deck (eigene Kopie)';
  }

  protected locationValue(location: BlockLocation) {
    return location.kind === 'library' ? 'library' : location.deck;
  }

  /** Save targets offered for a block: this deck, plus the file it currently comes from. */
  protected locationChoices(info: BlockInfo | undefined): BlockLocation[] {
    const own: BlockLocation = { kind: 'deck', deck: this.deckId() };
    const choices: BlockLocation[] = this.isChild() ? [own] : [];
    if (info && !choices.some((c) => sameLocation(c, info.location))) choices.push(info.location);
    return choices;
  }

  protected revertBlock(id: string) {
    const original = this.blockOriginals()[id];
    if (original) this.updateDraft(id, original);
  }

  protected async deleteOwnCopy(id: string) {
    const info = this.blockInfo().get(id);
    const fallback = info?.shadows[0];
    if (!fallback) return;
    if (!confirm(`Die eigene Kopie von „${this.titleOf(id)}“ in diesem Deck löschen? Danach gilt wieder die Version aus: ${this.where(fallback)}.`)) {
      return;
    }
    try {
      this.buildResult.set(await this.api.deleteDeckBlock(this.deckId(), id));
      this.blockDrafts.update(({ [id]: _, ...rest }) => rest);
      this.blockOriginals.update(({ [id]: _, ...rest }) => rest);
      await this.reloadDetails();
      await this.ensureBlock(id);
    } catch (e) {
      this.saveProblems.set(problemsOf(e));
    }
  }

  protected async addSlide(request: AddSlideRequest) {
    try {
      if (request.mode === 'new') {
        const template = blockTemplate(request.layout, request.id, request.title);
        const draft: BlockDraft = { location: request.location, ...template };
        await this.api.saveBlock(this.deckId(), request.id, draft, true);
      }
      this.insertSlide(request.id, request.parent);
      // persist the slide list right away, so new block files never end up orphaned
      await this.save();
      await this.reloadDetails();
      this.select(request.id);
    } catch (e) {
      this.saveProblems.set(problemsOf(e));
    }
  }

  // ---- saving ------------------------------------------------------------------------------

  protected async save() {
    if (this.saving()) return;
    this.saving.set(true);
    this.saveProblems.set([]);
    try {
      let result: SaveResult | null = null;
      for (const id of this.dirtyBlocks()) {
        const draft = this.blockDrafts()[id];
        result = await this.api.saveBlock(this.deckId(), id, draft);
        this.blockOriginals.update((o) => ({ ...o, [id]: draft }));
      }
      const deck = this.deckDraft();
      if (deck && this.deckDirty()) {
        const saved = await this.api.saveDeck(this.deckId(), deck);
        result = saved;
        this.details.update((d) => d && { ...d, deck: saved.deck });
      }
      if (result) {
        this.buildResult.set(result);
        this.savedAt.set(new Date());
        await this.reloadDetails();
      }
    } catch (e) {
      this.saveProblems.set(problemsOf(e));
    } finally {
      this.saving.set(false);
    }
  }

  protected discardAll() {
    if (!confirm('Alle ungespeicherten Änderungen verwerfen?')) return;
    const saved = this.details()?.deck;
    if (saved) this.deckDraft.set(structuredClone(saved));
    this.blockDrafts.set({ ...this.blockOriginals() });
  }

  protected onKeydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      void this.save();
    }
  }

  protected onBeforeUnload(event: BeforeUnloadEvent) {
    if (this.dirtyCount() > 0) event.preventDefault();
  }

  // ---- preview -----------------------------------------------------------------------------

  private setupPreview() {
    let seq = 0;
    effect((onCleanup) => {
      const id = this.previewId();
      const deck = this.deckDraft();
      const block = id ? this.blockDrafts()[id] : undefined;
      if (!id || !deck) return;
      const timer = setTimeout(async () => {
        const mine = ++seq;
        try {
          const result = await this.api.preview(this.deckId(), { blockId: id, block, deck });
          if (mine !== seq) return;
          if (result.slide) {
            this.preview.set(result.slide);
            this.previewAccent.set(result.company?.accent);
          }
          this.previewProblems.set(result.problems);
        } catch (e) {
          if (mine === seq) this.previewProblems.set(problemsOf(e));
        }
      }, 250);
      onCleanup(() => clearTimeout(timer));
    });
    inject(DestroyRef).onDestroy(() => (seq = -1));
  }
}
