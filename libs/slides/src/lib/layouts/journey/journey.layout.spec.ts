import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { ResolvedBlockOf } from '@this-is-me/content';
import { JourneyLayout } from './journey.layout';

const block = {
  id: 'weg',
  layout: 'journey',
  title: 'Mein Weg',
  steps: 4,
  bodyHtml: '',
  notesHtml: '',
  image: 'media/werdegang.jpg',
  imageSize: [851, 577],
  highlight: ['b'],
  stations: [
    { id: 'a', at: [90, 94], year: '2014', title: 'Abitur', tags: ['x'] },
    { id: 'b', at: [44, 83], via: [[72, 89]], year: '2015', title: 'Studium', tags: ['y'] },
    { id: 'c', at: [39.5, 33], year: 'Danach', title: 'Gipfel', tags: ['z'], summit: true },
  ],
  secret: { at: [9, 74], year: 'Geheim', title: 'Hütte', tags: ['h'] },
} as unknown as ResolvedBlockOf<'journey'>;

describe('JourneyLayout', () => {
  let fixture: ComponentFixture<JourneyLayout>;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) => el().querySelector(selector)?.textContent?.trim();
  const camVar = (name: string) => (el().querySelector('.cam') as HTMLElement).style.getPropertyValue(name);

  async function render(step: number) {
    fixture = TestBed.createComponent(JourneyLayout);
    fixture.componentRef.setInput('block', block);
    fixture.componentRef.setInput('step', step);
    await fixture.whenStable();
  }

  it('shows the overview card and no toggle button at step 0', async () => {
    await render(0);
    expect(text('.card h1')).toBe('Mein Weg');
    expect(text('.card .chips')).toContain('in 3 Etappen');
    expect(el().querySelector('.zoom.hidden')).not.toBeNull();
    expect(camVar('--s')).toBe('1');
  });

  it('zooms to the current station and marks earlier pins as done', async () => {
    await render(2);
    expect(text('.card h1')).toBe('Studium');
    expect(Number(camVar('--s'))).toBeCloseTo(1.3);
    const pins = el().querySelectorAll('.pin');
    expect(pins).toHaveLength(3);
    expect([...pins].map((p) => p.classList.contains('done'))).toEqual([true, true, false]);
    expect(pins[1].classList.contains('highlight')).toBe(true);
    expect(pins[2].classList.contains('flag')).toBe(true);
  });

  it('puts the card on the side opposite to the station', async () => {
    await render(2); // station b at x = 44 -> card right
    expect(el().querySelector('.card')?.classList.contains('right')).toBe(true);
    await render(1); // station a at x = 90 -> card left
    expect(el().querySelector('.card')?.classList.contains('right')).toBe(false);
  });

  it('emits requestStep when a pin is clicked', async () => {
    await render(1);
    const requested: number[] = [];
    fixture.componentInstance.requestStep.subscribe((s) => requested.push(s));
    (el().querySelectorAll('.pin')[2] as HTMLElement).click();
    expect(requested).toEqual([3]);
  });

  it('toggles the overview with the button and leaves it on step change', async () => {
    await render(2);
    const toggle = el().querySelector('.zoom') as HTMLButtonElement;
    toggle.click();
    await fixture.whenStable();
    expect(camVar('--s')).toBe('1');
    expect(toggle.textContent).toContain('Zurück zur Station');
    expect(el().hasAttribute('data-no-advance')).toBe(true);

    fixture.componentRef.setInput('step', 3);
    await fixture.whenStable();
    expect(Number(camVar('--s'))).toBeCloseTo(1.0); // summit zoom
    expect(el().hasAttribute('data-no-advance')).toBe(false);
  });

  it('zooms onto the hidden hut and returns with the button', async () => {
    await render(1);
    (el().querySelector('.hut') as HTMLElement).click();
    await fixture.whenStable();
    expect(Number(camVar('--s'))).toBeCloseTo(2.2);
    await new Promise((r) => setTimeout(r, 300)); // card cross-fade
    await fixture.whenStable();
    expect(text('.card h1')).toBe('Hütte');
    (el().querySelector('.zoom') as HTMLElement).click();
    await fixture.whenStable();
    expect(Number(camVar('--s'))).toBeCloseTo(1.3);
  });
});
