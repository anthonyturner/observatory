import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router } from '@angular/router';
import { provideAppRouter } from './app.routes';
import { GuidePage } from './features/guide/guide-page/guide-page';
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

  it('gives a pull request’s file page the pull request’s number, beside the project’s owner and repo', async () => {
    const { leaf } = await open('/p/me/app/pull/7/file?sha=abc1234&path=src%2Fa.ts');

    expect(leaf.params).toEqual({ owner: 'me', repo: 'app', number: '7' });
    expect(leaf.queryParams).toEqual({ sha: 'abc1234', path: 'src/a.ts' });
    expect(leaf.title).toBe('File · Observatory');
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

  it('opens each book at its own address, under its own title', async () => {
    const guide = await open('/docs/guide');
    expect(guide.leaf.title).toBe('Guide · Observatory');
    expect(guide.leaf.component).toBe(GuidePage);

    const sheet = await open('/docs/git-cheat-sheet');
    expect(sheet.leaf.title).toBe('Git cheat sheet · Observatory');
    expect(sheet.leaf.component).toBe(GuidePage);
  });

  it('keeps the anchor and the query when an old address moves to the docs', async () => {
    const moves = [
      ['/guide', '/docs/guide'],
      ['/guide#releases', '/docs/guide#releases'],
      ['/git-cheat-sheet', '/docs/git-cheat-sheet'],
      [
        '/git-cheat-sheet#fetch-download-what-is-new',
        '/docs/git-cheat-sheet#fetch-download-what-is-new',
      ],
      ['/guide?q=star#orrery', '/docs/guide?q=star#orrery'],
    ];
    for (const [from, to] of moves) {
      expect((await open(from)).router.url, from).toBe(to);
    }
  });

  it('sends the docs address with no book, and an unknown book, to the Guide', async () => {
    expect((await open('/docs')).router.url).toBe('/docs/guide');
    expect((await open('/docs/nowhere')).router.url).toBe('/docs/guide');
    expect((await open('/docs/guide/nowhere')).router.url).toBe('/');
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
