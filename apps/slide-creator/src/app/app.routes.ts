import { Routes } from '@angular/router';
import { DeckListPage } from './pages/deck-list.page';

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: DeckListPage, title: 'Decks · Slide-Creator' },
  {
    path: 'deck/:deckId',
    loadComponent: () => import('./pages/deck-editor.page').then((m) => m.DeckEditorPage),
    title: 'Deck bearbeiten · Slide-Creator',
  },
  { path: '**', redirectTo: '' },
];
