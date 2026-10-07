import { LibraryPage } from './library-report';
import { isMatch, pageTextOf, searchTerms, snippetOf } from './library-search';

const page = (markdown: string, title = 'Rules'): LibraryPage => ({
  slug: 'docs/rules',
  title,
  shelf: 'Docs',
  url: 'https://github.com/me/app/blob/main/docs/rules.md',
  markdown,
});

describe('pageTextOf', () => {
  it('reads the words a reader sees, leaving out markup and link addresses', () => {
    const text = pageTextOf(
      page('# Rules\n\n- **Never** [force-push](https://x.dev/push).\n\n| a |\n|---|\n| cell |'),
    );

    expect(text.text).toBe('Rules Never force-push. a cell');
    expect(text.wordCount).toBe(5);
    expect(text.haystack).toContain('rules rules never');
  });
});

describe('search', () => {
  const rules = pageTextOf(page('Squash merge every pull request.', 'Merging'));

  it('matches a page holding every term, in its title or text, whatever the case', () => {
    expect(isMatch(rules, searchTerms('  SQUASH   merging '))).toBe(true);
    expect(isMatch(rules, searchTerms('squash rebase'))).toBe(false);
  });

  it('shows the text around the first term found, or nothing for a title match', () => {
    const long = `${'a '.repeat(60)}the squash merge ${'b '.repeat(60)}`;

    expect(snippetOf(long, ['squash'])).toMatch(/^….*squash merge.*…$/);
    expect(snippetOf('Short squash.', ['squash'])).toBe('Short squash.');
    expect(snippetOf('Nothing here.', ['merging'])).toBeNull();
  });
});
