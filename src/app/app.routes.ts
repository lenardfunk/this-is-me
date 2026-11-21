import { Routes, UrlMatchResult, UrlSegment } from '@angular/router';
import { HubPage } from './pages/hub/hub.page';
import { PresentPage } from './pages/present/present.page';

/** `d/:deck/:slide` and `d/:deck/:slide/:sub` share one route so the page instance is reused. */
export function presentMatcher(segments: UrlSegment[]): UrlMatchResult | null {
  if (segments[0]?.path !== 'd' || segments.length < 3 || segments.length > 4) return null;
  const posParams: Record<string, UrlSegment> = { deck: segments[1], slide: segments[2] };
  if (segments[3]) posParams['sub'] = segments[3];
  return { consumed: segments, posParams };
}

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'd/default' },
  { path: 'd/:deck', pathMatch: 'full', component: HubPage, data: { page: 'hub' } },
  { matcher: presentMatcher, component: PresentPage, data: { page: 'present' } },
  {
    path: 'presenter/:deck',
    pathMatch: 'full',
    loadComponent: () => import('./pages/presenter/presenter.page').then((m) => m.PresenterPage),
    data: { page: 'presenter' },
  },
  { path: '**', redirectTo: '' },
];
