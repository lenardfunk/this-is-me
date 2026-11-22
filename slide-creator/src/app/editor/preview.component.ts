import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import type { ResolvedSlide } from '../../../../src/app/core/content.schema';
import { SlideHost } from '../../../../src/app/stage/slide-host.component';
import { StageComponent } from '../../../../src/app/stage/stage.component';

/** Live preview with the real slide components of the presentation app. */
@Component({
  selector: 'sc-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StageComponent, SlideHost],
  template: `
    <div class="frame" [class.stale]="stale()">
      <app-stage [accent]="accent()">
        @if (slide(); as s) {
          <app-slide-host [block]="s" [step]="step()" [interactive]="false" [named]="false" />
        }
      </app-stage>
      @if (!slide()) {
        <div class="empty">Keine Vorschau</div>
      }
    </div>
    <div class="controls">
      <button type="button" class="btn ghost icon-only" title="Schritt zurück" [disabled]="step() === 0" (click)="step.set(step() - 1)">
        <span class="icon">chevron_left</span>
      </button>
      <span class="step">Schritt {{ step() + 1 }} / {{ steps() }}</span>
      <button type="button" class="btn ghost icon-only" title="Nächster Schritt" [disabled]="step() >= steps() - 1" (click)="step.set(step() + 1)">
        <span class="icon">chevron_right</span>
      </button>
      <span class="spacer"></span>
      @if (presentUrl()) {
        <a class="btn small ghost" [href]="presentUrl()" target="_blank" rel="noopener" title="Öffnet die Präsentations-App (npm start, Port 4200)">
          <span class="icon">open_in_new</span> In der App öffnen
        </a>
      }
    </div>
    @if (slide()?.notesHtml) {
      <section class="notes">
        <h3>Sprechernotizen</h3>
        <div [innerHTML]="slide()!.notesHtml"></div>
      </section>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .frame {
      position: relative;
      aspect-ratio: 16 / 9;
      border-radius: 14px;
      overflow: hidden;
      box-shadow:
        0 1px 2px rgba(0, 0, 0, 0.08),
        0 12px 32px rgba(31, 30, 27, 0.14);
      transition: opacity 0.2s;
      &.stale {
        opacity: 0.55;
      }
    }
    .empty {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: #bbb;
    }
    .controls {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 10px 0 18px;
      .step {
        font-size: 13px;
        color: var(--muted);
        min-width: 92px;
        text-align: center;
      }
      .spacer {
        flex: 1;
      }
    }
    .notes {
      font-size: 14px;
      padding: 14px 16px;
      border-radius: 12px;
      background: var(--surface);
      border: 1px solid var(--line);
      h3 {
        font: 600 12px/1.2 var(--font-sans);
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--muted);
        margin: 0 0 8px;
      }
      :first-child {
        margin-top: 0;
      }
    }
  `,
})
export class PreviewComponent {
  readonly slide = input<ResolvedSlide | null>(null);
  readonly accent = input<string | undefined>();
  /** True while the slide shown is outdated (e.g. the current draft is invalid). */
  readonly stale = input(false);
  readonly presentUrl = input<string>();

  protected readonly steps = computed(() => this.slide()?.steps ?? 1);
  /** Keeps the current step while editing, clamped to the slide's step count. */
  protected readonly step = linkedSignal<number, number>({
    source: () => this.steps(),
    computation: (steps, previous) => Math.min(previous?.value ?? 0, steps - 1),
  });
}
