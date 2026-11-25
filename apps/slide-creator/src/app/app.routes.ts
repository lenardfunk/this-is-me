import { Routes } from '@angular/router';
import { DeckListPage } from './pages/deck-list.page';
import { PublicationPage } from './pages/publication.page';

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: DeckListPage, title: 'Decks · Slide-Creator' },
  { path: 'veroeffentlichung', component: PublicationPage, title: 'Veröffentlichung · Slide-Creator' },
  {
    path: 'deck/:deckId',
    loadComponent: () => import('./pages/deck-editor.page').then((m) => m.DeckEditorPage),
    title: 'Deck bearbeiten · Slide-Creator',
  },
  { path: '**', redirectTo: '' },
];
