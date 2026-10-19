import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { IndexEntry, IndexShelf } from '../library-page/library-view';
import { LibraryIndex } from './library-index';

const entry = (title: string): IndexEntry => ({
  slug: title,
  title,
  link: `/${title}`,
  fragment: null,
  diameter: 6,
  isCurrent: false,
  snippet: null,
});

function render(shelves: readonly IndexShelf[]): HTMLElement {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(LibraryIndex);
  fixture.componentRef.setInput('shelves', shelves);
  fixture.componentRef.setInput('resultLine', null);
  fixture.componentRef.setInput('isStill', true);
  fixture.componentRef.setInput('query', '');
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const texts = (element: HTMLElement, selector: string): (string | null)[] =>
  Array.from(element.querySelectorAll(selector)).map((node) => node.textContent);

describe('LibraryIndex', () => {
  it('draws shelves without groups as it always has: each name a top heading', () => {
    const element = render([
      { name: 'Docs', entries: [entry('One')] },
      { name: 'Notes', entries: [entry('Two')] },
    ]);

    expect(texts(element, 'nav h2')).toEqual(['Docs', 'Notes']);
    expect(element.querySelector('.group')).toBeNull();
    expect(element.querySelectorAll('nav section')).toHaveLength(2);
  });

  it('puts shelves that share a group under its heading, with their names a level down', () => {
    const element = render([
      { name: 'Orrery', group: 'Guide', entries: [entry('Worlds')] },
      { name: 'Tabs', group: 'Guide', entries: [entry('Releases')] },
      { name: null, group: 'Cheat sheets', entries: [entry('Sheet')] },
    ]);

    expect(texts(element, 'nav h2')).toEqual(['Guide', 'Cheat sheets']);
    expect(texts(element, 'nav h3')).toEqual(['Orrery', 'Tabs']);
    expect(element.querySelectorAll('nav section')).toHaveLength(3);
  });

  it('draws a shelf with no name as its stars alone', () => {
    const element = render([{ name: null, entries: [entry('Sheet')] }]);

    expect(element.querySelector('nav h2, nav h3')).toBeNull();
    expect(texts(element, 'nav a')).toEqual(['Sheet']);
  });
});
