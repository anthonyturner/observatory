import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router } from '@angular/router';
import { provideAppRouter } from './app.routes';
import { PROJECT_TABS } from './shared/project-tabs/project-tabs';

function leafOf(route: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
  return route.firstChild ? leafOf(route.firstChild) : route;
}

async function open(url: string) {
  const router = TestBed.inject(Router);
  await router.navigateByUrl(url);
  return { router, leaf: leafOf(router.routerState.snapshot.root) };
}

describe('the app’s routes', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideAppRouter()] }));

  it('gives every project screen the project’s owner and repo, and its own title', async () => {
    for (const tab of PROJECT_TABS) {
      const { leaf } = await open(`/p/me/app${tab.path && `/${tab.path}`}`);

      expect(leaf.params['owner'], tab.id).toBe('me');
      expect(leaf.params['repo'], tab.id).toBe('app');
      expect(leaf.title, tab.id).toContain('Observatory');
    }
  });

  it('names the Queue and the Releases by title', async () => {
    expect((await open('/p/me/app')).leaf.title).toBe('Review Queue · Observatory');
    expect((await open('/p/me/app/releases')).leaf.title).toBe('Releases · Observatory');
  });

  it('gives a Library page its folders as the page, beside the project’s owner and repo', async () => {
    const { leaf } = await open('/p/me/app/library/docs/stack');

    expect(leaf.params).toEqual({ owner: 'me', repo: 'app', page: 'docs/stack' });
    expect(leaf.title).toBe('Library · Observatory');
  });

  it('keeps a pull request link’s query on the Queue', async () => {
    const { leaf } = await open('/p/me/app?pr=12');

    expect(leaf.queryParams['pr']).toBe('12');
  });

  it('sends an unknown address under a project home', async () => {
    const { router } = await open('/p/me/app/nowhere');

    expect(router.url).toBe('/');
  });
});
