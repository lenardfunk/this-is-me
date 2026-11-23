import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, inject, provideBrowserGlobalErrorListeners } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  withComponentInputBinding,
  withViewTransitions,
} from '@angular/router';
import { routes } from './app.routes';
import { DeckStore } from './core/deck.store';

const leaf = (snapshot: ActivatedRouteSnapshot) => {
  while (snapshot.firstChild) snapshot = snapshot.firstChild;
  return snapshot;
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withViewTransitions({
        skipInitialTransition: true,
        onViewTransitionCreated: ({ transition, from, to }) => {
          const a = leaf(from);
          const b = leaf(to);
          // Step changes only touch query params (or nothing) – no animation.
          // Hidden documents cannot render a transition (and would stall the navigation).
          const sameRoute = a.routeConfig === b.routeConfig && JSON.stringify(a.params) === JSON.stringify(b.params);
          if (document.hidden || sameRoute) {
            transition.skipTransition();
            return;
          }
          const root = document.documentElement;
          root.dataset['nav'] = a.data['page'] === 'hub' || b.data['page'] === 'hub' ? 'hub' : 'slides';
          const store = inject(DeckStore);
          const backwards = store.direction() < 0;
          if (store.axis() === 'y') root.dataset['dir'] = backwards ? 'up' : 'down';
          else root.dataset['dir'] = backwards ? 'back' : 'fwd';
        },
      }),
    ),
  ],
};
