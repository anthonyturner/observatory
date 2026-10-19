import { TestBed } from '@angular/core/testing';
import { DOCS_BOOKS } from './docs-books';

describe('the docs registry', () => {
  const books = TestBed.inject(DOCS_BOOKS);

  it('gives every book its own address', () => {
    const slugs = books.map((book) => book.slug);

    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('names each cheat sheet after its file, as the wiki publishes only files that match', () => {
    const sheets = books.filter((book) => book.group === 'Cheat sheets');

    expect(sheets.length).toBeGreaterThan(0);
    for (const sheet of sheets) {
      expect(`${sheet.slug}.md`, sheet.title).toMatch(/^[a-z0-9-]+-cheat-sheet\.md$/);
    }
  });
});
