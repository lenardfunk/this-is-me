import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { DeckSummary } from '../../../shared/api.types';
import { ApiService, problemsOf } from '../api.service';
import { KEBAB, slugify } from '../model';

/** Start page: all decks, and a form to create a new one (typically for a company). */
@Component({
  selector: 'sc-deck-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <header class="top">
      <div class="brand"><span class="icon">slideshow</span> Slide-Creator</div>
      <span class="sub">für this-is-me</span>
    </header>

    <main>
      <h1>Decks</h1>
      <p class="lead">Wähle ein Deck zum Bearbeiten – oder lege ein neues für eine Bewerbung an.</p>

      @if (error().length) {
        <div class="problems">
          <ul>
            @for (p of error(); track p) {
              <li>{{ p }}</li>
            }
          </ul>
        </div>
      }

      <div class="grid">
        @for (d of decks(); track d.id) {
          <a class="deck card" [routerLink]="['/deck', d.id]" [style.--accent]="d.accent ?? null">
            <span class="swatch"></span>
            <span class="title">{{ d.title }}</span>
            <span class="meta">
              <code>{{ d.id }}</code>
              @if (d.company) {
                · {{ d.company }}
              }
            </span>
            <span class="badges">
              @if (d.extends) {
                <span class="badge"><span class="icon">subdirectory_arrow_right</span> erbt von {{ d.extends }}</span>
              } @else {
                <span class="badge accent">Basis-Deck</span>
              }
              @if (d.unlisted) {
                <span class="badge">nicht gelistet</span>
              }
              @if (d.error) {
                <span class="badge warn">Fehler</span>
              }
            </span>
          </a>
        }
        @if (!creating()) {
          <button type="button" class="deck new card" (click)="startCreate()">
            <span class="icon big">add</span>
            <span class="title">Neues Deck</span>
            <span class="meta">z. B. für eine Firma, bei der du dich bewirbst</span>
          </button>
        }
      </div>

      @if (creating()) {
        <form class="create card" (submit)="$event.preventDefault(); create()">
          <h2>Neues Deck</h2>
          <div class="row">
            <div class="field">
              <label for="company">Firma</label>
              <input id="company" [value]="company()" (input)="company.set($any($event.target).value)" placeholder="z. B. ACME GmbH" autofocus />
              <span class="hint">Ersetzt {{ companyToken }} in allen Folien</span>
            </div>
            <div class="field accent-field">
              <label for="accent">Akzentfarbe</label>
              <div class="color">
                <input id="accent" type="color" [value]="accent()" (input)="accent.set($any($event.target).value)" />
                <code>{{ accent() }}</code>
              </div>
            </div>
          </div>
          <div class="row">
            <div class="field">
              <label for="title">Titel</label>
              <input id="title" [value]="title()" [placeholder]="defaultTitle()" (input)="title.set($any($event.target).value)" />
            </div>
            <div class="field">
              <label for="id">Deck-ID (Ordnername, URL)</label>
              <input id="id" [value]="id()" [placeholder]="defaultId()" (input)="id.set($any($event.target).value)" />
              @if (idProblem()) {
                <span class="hint err">{{ idProblem() }}</span>
              } @else {
                <span class="hint">content/decks/{{ effectiveId() || '…' }}/ · /d/{{ effectiveId() || '…' }}</span>
              }
            </div>
          </div>
          <div class="row">
            <div class="field">
              <label for="extends">Erbt von</label>
              <select id="extends" [value]="extendsId()" (change)="extendsId.set($any($event.target).value)">
                <option value="">– nichts (eigenständiges Deck) –</option>
                @for (d of decks(); track d.id) {
                  <option [value]="d.id" [selected]="extendsId() === d.id">{{ d.title }} ({{ d.id }})</option>
                }
              </select>
            </div>
            <div class="field">
              <span class="label">Folien</span>
              @if (extendsId()) {
                <label class="check"><input type="radio" name="slides" [checked]="!copySlides()" (change)="copySlides.set(false)" /> Folienliste erben (folgt Änderungen am Basis-Deck)</label>
                <label class="check"><input type="radio" name="slides" [checked]="copySlides()" (change)="copySlides.set(true)" /> Folienliste kopieren (unabhängig umsortierbar)</label>
              } @else {
                <span class="hint">Startet mit einer leeren Folienliste.</span>
              }
            </div>
          </div>
          <label class="check"><input type="checkbox" [checked]="unlisted()" (change)="unlisted.set($any($event.target).checked)" /> Nicht in der Deck-Auswahl auflisten (nur per Link erreichbar)</label>
          <div class="actions">
            <button type="button" class="btn ghost" (click)="creating.set(false)">Abbrechen</button>
            <button type="submit" class="btn primary" [disabled]="!!idProblem() || busy()"><span class="icon">add</span> Deck anlegen</button>
          </div>
        </form>
      }
    </main>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
    }
    .top {
      display: flex;
      align-items: baseline;
      gap: 10px;
      padding: 18px 32px;
    }
    .brand {
      font: 500 20px/1 var(--font-serif);
      display: flex;
      align-items: center;
      gap: 8px;
      .icon {
        color: var(--accent);
      }
    }
    .sub {
      color: var(--muted);
      font-size: 13px;
    }
    main {
      max-width: 1080px;
      margin: 0 auto;
      padding: 24px 32px 64px;
    }
    h1 {
      font-size: 44px;
      margin-bottom: 6px;
    }
    .lead {
      color: var(--muted);
      margin: 0 0 28px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }
    .deck {
      position: relative;
      display: grid;
      gap: 6px;
      align-content: start;
      padding: 22px 22px 18px;
      min-height: 150px;
      text-decoration: none;
      color: inherit;
      text-align: left;
      cursor: pointer;
      overflow: hidden;
      transition:
        transform 0.15s,
        box-shadow 0.15s;
      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 28px rgba(31, 30, 27, 0.1);
      }
    }
    .swatch {
      position: absolute;
      inset: 0 0 auto;
      height: 5px;
      background: var(--accent);
    }
    .title {
      font: 400 24px/1.2 var(--font-serif);
    }
    .meta {
      color: var(--muted);
      font-size: 13px;
    }
    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
      .icon {
        font-size: 14px;
      }
    }
    .new {
      border-style: dashed;
      background: transparent;
      place-items: center;
      text-align: center;
      align-content: center;
      .big {
        font-size: 32px;
        color: var(--accent);
      }
    }
    .create {
      margin-top: 24px;
      padding: 24px 28px;
      h2 {
        font-size: 28px;
        margin-bottom: 18px;
      }
    }
    .color {
      display: flex;
      align-items: center;
      gap: 10px;
      height: 38px;
      input {
        width: 46px;
        height: 36px;
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 2px;
        background: var(--surface);
      }
    }
    .accent-field {
      flex: 0 0 180px;
    }
    .field .check {
      font-size: 14px;
      margin: 2px 0;
    }
    .err {
      color: var(--sc-danger) !important;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 18px;
    }
  `,
})
export class DeckListPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  protected readonly decks = signal<DeckSummary[]>([]);
  protected readonly error = signal<string[]>([]);
  protected readonly creating = signal(false);
  protected readonly busy = signal(false);
  protected readonly companyToken = '{{company.name}}';

  protected readonly company = signal('');
  protected readonly accent = signal('#534ab7');
  protected readonly title = signal('');
  protected readonly id = signal('');
  protected readonly extendsId = signal('default');
  protected readonly copySlides = signal(false);
  protected readonly unlisted = signal(true);

  protected readonly defaultTitle = computed(() => (this.company() ? `Bewerbung ${this.company()}` : 'Selbstvorstellung'));
  protected readonly defaultId = computed(() => slugify(this.company()));
  protected readonly effectiveId = computed(() => this.id() || this.defaultId());
  protected readonly idProblem = computed(() => {
    const id = this.effectiveId();
    if (!id) return 'Bitte Firma oder Deck-ID angeben';
    if (!KEBAB.test(id)) return 'Nur Kleinbuchstaben, Ziffern und Bindestriche';
    if (this.decks().some((d) => d.id === id)) return `Ein Deck „${id}“ gibt es schon`;
    return '';
  });

  constructor() {
    this.load();
  }

  private async load() {
    try {
      this.decks.set(await this.api.decks());
      this.error.set([]);
    } catch (e) {
      this.error.set(problemsOf(e));
    }
  }

  protected startCreate() {
    this.extendsId.set(this.decks().some((d) => d.id === 'default') ? 'default' : '');
    this.creating.set(true);
  }

  protected async create() {
    if (this.idProblem()) return;
    this.busy.set(true);
    try {
      const id = this.effectiveId();
      const extendsId = this.extendsId() || undefined;
      await this.api.createDeck({
        id,
        title: this.title() || this.defaultTitle(),
        extends: extendsId,
        unlisted: this.unlisted(),
        company: this.company() ? { name: this.company(), accent: this.accent().toUpperCase() } : undefined,
        copySlidesFrom: extendsId && this.copySlides() ? extendsId : undefined,
      });
      await this.router.navigate(['/deck', id]);
    } catch (e) {
      this.error.set(problemsOf(e));
    } finally {
      this.busy.set(false);
    }
  }
}
