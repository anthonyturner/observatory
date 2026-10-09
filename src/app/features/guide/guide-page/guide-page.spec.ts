import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GUIDE_MARKDOWN } from '../../../core/guide/guide-markdown';
import { GuidePage } from './guide-page';

const MARKDOWN = `# Observatory guide

Welcome to the sky.

## Orrery

### Worlds

Air colour is the most urgent state.

## Project tabs

### Releases

Each release is a star.

### Actions

Each workflow is a lane.
`;

function render() {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: GUIDE_MARKDOWN, useValue: MARKDOWN }],
  });
  const fixture = TestBed.createComponent(GuidePage);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const filter = (words: string): void => {
    const box = element.querySelector<HTMLInputElement>('input[type="search"]');
    if (!box) throw new Error('no filter box');
    box.value = words;
    box.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  return { element, filter };
}

const headings = (element: HTMLElement): (string | undefined)[] =>
  Array.from(element.querySelectorAll('article h2, article h3')).map((h) => h.textContent?.trim());

describe('GuidePage', () => {
  it('shows the intro, then every part and section, each with its anchor', () => {
    const { element } = render();

    expect(element.querySelector('article p')?.textContent).toContain('Welcome to the sky.');
    expect(headings(element)).toEqual(['Orrery', 'Worlds', 'Project tabs', 'Releases', 'Actions']);
    expect(element.querySelector('#doc-releases')?.tagName).toBe('H3');
  });

  it('lists the sections in its contents, each linking to its anchor', () => {
    const { element } = render();

    const links = Array.from(element.querySelectorAll('nav[aria-label="Contents"] a'));
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/guide#worlds',
      '/guide#releases',
      '/guide#actions',
    ]);
  });

  it('narrows the text and the contents to the sections a filter finds', () => {
    const { element, filter } = render();

    filter('workflow');

    expect(headings(element)).toEqual(['Project tabs', 'Actions']);
    expect(element.querySelector('[role="status"]')?.textContent).toContain('1 section matches.');
  });

  it('says so when nothing matches', () => {
    const { element, filter } = render();

    filter('nebula');

    expect(headings(element)).toEqual([]);
    expect(element.querySelector('.empty')?.textContent).toContain('Nothing in the guide matches.');
  });
});
