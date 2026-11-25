import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { PublicationAction, PublicationInfo, PublicationList } from '../../../shared/api.types';
import { ApiService, problemsOf } from '../api.service';

type Confirm = { deck: string; action: 'rotate' | 'revoke' };

const STATE_LABEL: Record<PublicationInfo['state'], string> = {
  draft: 'Entwurf',
  live: 'Live',
  revoked: 'Widerrufen',
  expired: 'Abgelaufen',
};

/**
 * Admin view of the private links: which application is reachable under which UUID, who got the link,
 * when it expires. The UUIDs are the only access protection of a deck, so this page is the only place
 * where they are listed (the deployed app has no deck list).
 */
@Component({
  selector: 'sc-publication-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <header class="top">
      <a class="brand" routerLink="/"><span class="icon">slideshow</span> Slide-Creator</a>
      <span class="sub">Veröffentlichung</span>
    </header>

    <main>
      <h1>Veröffentlichung</h1>
      <p class="lead">
        Jede Bewerbung ist im Netz nur über ihren eigenen, nicht erratbaren Link erreichbar. Vorlagen wie das Standard-Deck
        werden nicht veröffentlicht.
      </p>

      @if (problems().length) {
        <div class="problems">
          <ul>
            @for (p of problems(); track p) {
              <li>{{ p }}</li>
            }
          </ul>
        </div>
      }

      @if (list(); as data) {
        @if (!data.baseUrl) {
          <div class="problems warn">
            <ul>
              <li>
                Die Adresse der veröffentlichten App fehlt, deshalb zeigt die Liste nur Pfade. Lege
                <code>content/site.json</code> mit <code>{{ siteExample }}</code> an, sobald das Vercel-Projekt steht.
              </li>
            </ul>
          </div>
        }

        <div class="count">{{ liveCount() }} live · {{ data.items.length }} Bewerbungen</div>

        @for (item of data.items; track item.deck) {
          <section class="card pub" [style.--accent]="item.accent ?? null">
            <div class="head">
              <span class="title">{{ item.title }}</span>
              <code>{{ item.deck }}</code>
              @if (item.company) {
                <span class="company">{{ item.company }}</span>
              }
              <span class="badge" [class.accent]="item.state === 'live'" [class.warn]="item.state === 'expired' || item.state === 'revoked'">{{ label(item.state) }}</span>
              @if (item.deploy === 'uncommitted') {
                <span class="badge warn" title="Die Änderung ist erst lokal. Committen und pushen, dann deployt Vercel.">Noch nicht committet</span>
              } @else if (item.deploy === 'unpushed') {
                <span class="badge warn" title="Die Änderung ist committet. Mit dem Push deployt Vercel.">Noch nicht gepusht</span>
              }
            </div>

            @if (item.publication; as pub) {
              <div class="link" [class.dead]="item.state !== 'live'">{{ url(data, item) }}</div>

              <div class="actions">
                @if (item.state === 'live') {
                  <button type="button" class="btn small" (click)="copy(item.deck + ':link', url(data, item))">
                    <span class="icon">content_copy</span> {{ copied() === item.deck + ':link' ? 'Kopiert' : 'Link kopieren' }}
                  </button>
                  <button type="button" class="btn small" (click)="copy(item.deck + ':presenter', url(data, item, true))">
                    <span class="icon">co_present</span> {{ copied() === item.deck + ':presenter' ? 'Kopiert' : 'Präsentator-Link' }}
                  </button>
                  <button type="button" class="btn small" [disabled]="busy()" (click)="ask(item.deck, 'rotate')">
                    <span class="icon">refresh</span> Link rotieren
                  </button>
                }
                @if (item.state !== 'revoked') {
                  <button type="button" class="btn small" [disabled]="busy()" (click)="ask(item.deck, 'revoke')">
                    <span class="icon">block</span> Widerrufen
                  </button>
                } @else {
                  <button type="button" class="btn small" [disabled]="busy()" (click)="run(item.deck, { action: 'publish' })">
                    <span class="icon">public</span> Neu veröffentlichen
                  </button>
                }
                @if (item.state === 'expired') {
                  <button type="button" class="btn small" [disabled]="busy()" (click)="run(item.deck, { action: 'publish' })">
                    <span class="icon">public</span> Neu veröffentlichen
                  </button>
                }
              </div>

              @if (confirm()?.deck === item.deck) {
                <div class="confirm">
                  @if (confirm()!.action === 'rotate') {
                    <span>Neue UUID erzeugen? Der alte Link ist nach dem nächsten Deploy tot.</span>
                  } @else {
                    <span>Deck vom Netz nehmen? Es gibt danach keinen Link mehr.</span>
                  }
                  <button type="button" class="btn small danger" (click)="runConfirmed()">
                    {{ confirm()!.action === 'rotate' ? 'Rotieren' : 'Widerrufen' }}
                  </button>
                  <button type="button" class="btn small ghost" (click)="confirm.set(null)">Abbrechen</button>
                </div>
              }

              <div class="row meta">
                <div class="field">
                  <label [for]="'note-' + item.deck">Notiz: an wen, wann</label>
                  <input [id]="'note-' + item.deck" [value]="pub.note ?? ''" placeholder="z. B. per Mail an die Personalabteilung, 12.11." (change)="run(item.deck, { action: 'update', note: $any($event.target).value })" />
                </div>
                <div class="field date">
                  <label [for]="'exp-' + item.deck">Läuft ab</label>
                  <input [id]="'exp-' + item.deck" type="date" [value]="pub.expiresAt ?? ''" (change)="run(item.deck, { action: 'update', expiresAt: $any($event.target).value || null })" />
                </div>
              </div>
            } @else {
              <div class="link none">Noch keine öffentliche ID vergeben</div>
              <div class="actions">
                <button type="button" class="btn small" [disabled]="busy()" (click)="run(item.deck, { action: 'publish' })">
                  <span class="icon">public</span> Veröffentlichen
                </button>
              </div>
            }
          </section>
        } @empty {
          <p class="lead">Es gibt noch keine Bewerbungs-Decks. Lege eines auf der Startseite an.</p>
        }
      } @else if (!problems().length) {
        <p class="lead">Lädt …</p>
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
      color: inherit;
      text-decoration: none;
      .icon {
        color: var(--accent);
      }
    }
    .sub {
      color: var(--muted);
      font-size: 13px;
    }
    main {
      max-width: 860px;
      margin: 0 auto;
      padding: 24px 32px 64px;
    }
    h1 {
      font-size: 44px;
      margin-bottom: 6px;
    }
    .lead {
      color: var(--muted);
      margin: 0 0 24px;
    }
    .count {
      color: var(--muted);
      font-size: 13px;
      margin-bottom: 12px;
    }
    .pub {
      position: relative;
      padding: 18px 22px 16px;
      margin-bottom: 12px;
      overflow: hidden;
      &::before {
        content: '';
        position: absolute;
        inset: 0 auto 0 0;
        width: 5px;
        background: var(--accent);
      }
    }
    .head {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }
    .title {
      font: 400 22px/1.2 var(--font-serif);
    }
    .company {
      color: var(--muted);
      font-size: 13px;
    }
    .link {
      margin: 12px 0;
      font: 400 13px/1.5 var(--font-mono, ui-monospace, monospace);
      word-break: break-all;
      &.dead {
        text-decoration: line-through;
        color: var(--muted);
      }
      &.none {
        color: var(--muted);
        font-family: inherit;
      }
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .confirm {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 10px;
      padding: 8px 12px;
      border-radius: 10px;
      background: var(--sc-warn-soft);
      color: var(--sc-warn);
      font-size: 13px;
    }
    .meta {
      margin-top: 14px;
      align-items: flex-end;
    }
    .date {
      flex: 0 0 170px;
    }
  `,
})
export class PublicationPage {
  private readonly api = inject(ApiService);

  protected readonly list = signal<PublicationList | null>(null);
  protected readonly problems = signal<string[]>([]);
  protected readonly busy = signal(false);
  protected readonly confirm = signal<Confirm | null>(null);
  protected readonly copied = signal<string | null>(null);
  protected readonly siteExample = '{ "baseUrl": "https://dein-projekt.vercel.app" }';

  protected readonly liveCount = computed(() => this.list()?.items.filter((i) => i.state === 'live').length ?? 0);

  constructor() {
    void this.load();
  }

  protected label(state: PublicationInfo['state']) {
    return STATE_LABEL[state];
  }

  /** Full link to the deck, or only its path while the production address is not configured. */
  protected url(data: PublicationList, item: PublicationInfo, presenter = false): string {
    return `${data.baseUrl ?? ''}/${presenter ? 'presenter' : 'd'}/${item.publication?.id ?? ''}`;
  }

  private async load() {
    try {
      this.list.set(await this.api.publications());
      this.problems.set([]);
    } catch (e) {
      this.problems.set(problemsOf(e));
    }
  }

  protected ask(deck: string, action: Confirm['action']) {
    this.confirm.set({ deck, action });
  }

  protected runConfirmed() {
    const pending = this.confirm();
    if (pending) void this.run(pending.deck, { action: pending.action });
  }

  protected async run(deck: string, request: PublicationAction) {
    this.busy.set(true);
    this.confirm.set(null);
    try {
      const result = await this.api.updatePublication(deck, request);
      // the deploy state comes from git and may have changed for this deck, so reload the whole list
      await this.load();
      this.problems.set(result.problems);
    } catch (e) {
      this.problems.set(problemsOf(e));
      await this.load();
    } finally {
      this.busy.set(false);
    }
  }

  protected async copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(key);
      setTimeout(() => this.copied.update((k) => (k === key ? null : k)), 1500);
    } catch {
      this.problems.set(['Kopieren war nicht möglich. Markiere den Link und kopiere ihn von Hand.']);
    }
  }
}
