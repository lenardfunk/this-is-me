import { Routes, UrlMatchResult, UrlSegment } from '@angular/router';
import { HubPage } from './pages/hub/hub.page';
import { NotFoundPage } from './pages/not-found.page';
import { PresentPage } from './pages/present/present.page';

/** `d/:deck/:slide` and `d/:deck/:slide/:sub` share one route so the page instance is reused. */
export function presentMatcher(segments: UrlSegment[]): UrlMatchResult | null {
  if (segments[0]?.path !== 'd' || segments.length < 3 || segments.length > 4) return null;
  const posParams: Record<string, UrlSegment> = { deck: segments[1], slide: segments[2] };
  if (segments[3]) posParams['sub'] = segments[3];
  return { consumed: segments, posParams };
}

/**
 * `:deck` is the file name under `generated/decks/`: the public UUID in production, the folder name
 * when developing locally. There is deliberately no route for `/` and `/d`.
 */
export const routes: Routes = [
  { path: 'd/:deck', pathMatch: 'full', component: HubPage, data: { page: 'hub' } },
  { matcher: presentMatcher, component: PresentPage, data: { page: 'present' } },
  {
    path: 'presenter/:deck',
    pathMatch: 'full',
    loadComponent: () => import('./pages/presenter/presenter.page').then((m) => m.PresenterPage),
    data: { page: 'presenter' },
  },
  { path: '**', component: NotFoundPage, data: { page: 'not-found' } },
];
