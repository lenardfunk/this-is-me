import { DestroyRef, inject } from '@angular/core';

export type KeyAction = 'next' | 'prev' | 'down' | 'up' | 'hub' | 'presenter' | 'blackout' | 'help' | 'overview';

export interface KeyBinding {
  action: KeyAction;
  /** `KeyboardEvent.key` values (letters compared case-insensitively). */
  keys: string[];
  /** Labels for the help overlay. */
  labels: string[];
  description: string;
}

export const KEY_BINDINGS: KeyBinding[] = [
  { action: 'next', keys: ['ArrowRight', ' ', 'PageDown'], labels: ['→', 'Leertaste', 'Bild ↓'], description: 'Weiter (roter Faden)' },
  { action: 'prev', keys: ['ArrowLeft', 'PageUp'], labels: ['←', 'Bild ↑'], description: 'Zurück' },
  { action: 'down', keys: ['ArrowDown'], labels: ['↓'], description: 'Vertiefung öffnen / nächste Vertiefung' },
  { action: 'up', keys: ['ArrowUp'], labels: ['↑'], description: 'Vertiefung schließen / vorherige Vertiefung' },
  { action: 'hub', keys: ['Escape'], labels: ['Esc'], description: 'Zurück zur Übersicht' },
  { action: 'overview', keys: ['z'], labels: ['Z'], description: 'Werdegang: Gesamtbild an/aus' },
  { action: 'presenter', keys: ['p'], labels: ['P'], description: 'Präsentator-Fenster öffnen' },
  { action: 'blackout', keys: ['b'], labels: ['B'], description: 'Bildschirm abdunkeln' },
  { action: 'help', keys: ['?'], labels: ['?'], description: 'Tastatur-Hilfe' },
];

type KeyEventLike = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>;

/** Pure mapping from a key event to an action (no modifier combos). */
export function actionForEvent(event: KeyEventLike): KeyAction | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  return KEY_BINDINGS.find((b) => b.keys.includes(key))?.action ?? null;
}

/** True if the key would normally be used by the focused element itself. */
export function shouldIgnoreTarget(target: EventTarget | null, key: string): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return true;
  // Space/Enter activate buttons and links; do not additionally advance the deck.
  return (key === ' ' || key === 'Enter') && ['BUTTON', 'A', 'SUMMARY'].includes(target.tagName);
}

/**
 * Registers a global keydown handler for the lifetime of the calling component/service.
 * Actions without a handler are ignored (and not prevented).
 */
export function useDeckKeys(handlers: Partial<Record<KeyAction, () => void>>) {
  const onKeydown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || shouldIgnoreTarget(event.target, event.key)) return;
    const action = actionForEvent(event);
    const handler = action && handlers[action];
    if (!handler) return;
    event.preventDefault();
    handler();
  };
  window.addEventListener('keydown', onKeydown);
  inject(DestroyRef).onDestroy(() => window.removeEventListener('keydown', onKeydown));
}
