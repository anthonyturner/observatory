import { TestBed } from '@angular/core/testing';
import { parseReadAnswer } from './reader-parse';
import { PAGE_READER, PageReader, Reader } from './reader-service';
import { ReadablePage } from './reader.types';

const PAGE: ReadablePage = {
  url: 'https://example.com/a',
  title: 'A story',
  site: 'Example',
  published: null,
  image: null,
  blocks: [{ kind: 'paragraph', text: 'The story.' }],
  canEmbed: false,
  isThin: false,
};

describe('parseReadAnswer', () => {
  it('reads a page, keeping only web addresses and known kinds of block', () => {
    const page = parseReadAnswer({
      ...PAGE,
      image: 'javascript:alert(1)',
      blocks: [{ kind: 'paragraph', text: 'Kept.' }, { kind: 'script', text: 'Dropped.' }, 'nope'],
      canEmbed: 'yes',
    });
    expect(page).toEqual({ ...PAGE, blocks: [{ kind: 'paragraph', text: 'Kept.' }] });
  });

  it('reads a failure, and nothing from what is neither', () => {
    expect(parseReadAnswer({ url: 'https://x.com', failed: 'the site answered 401' })).toEqual({
      failed: 'the site answered 401',
    });
    expect(parseReadAnswer({ url: 'javascript:1', title: 't', site: 's' })).toBeNull();
    expect(parseReadAnswer('nope')).toBeNull();
  });
});

describe('Reader', () => {
  function setup(read: PageReader) {
    TestBed.configureTestingModule({ providers: [{ provide: PAGE_READER, useValue: read }] });
    return TestBed.inject(Reader);
  }

  it('opens a page: loading, then ready', async () => {
    const reader = setup(async () => PAGE);
    const opening = reader.open(PAGE.url);
    expect(reader.state()).toEqual({ status: 'loading', url: PAGE.url });
    await opening;
    expect(reader.state()).toEqual({ status: 'ready', url: PAGE.url, page: PAGE });
  });

  it('says why a page could not be read, and closes', async () => {
    const reader = setup(async () => ({ failed: 'the site answered 401' }));
    await reader.open(PAGE.url);
    expect(reader.state()).toEqual({
      status: 'failed',
      url: PAGE.url,
      failed: 'the site answered 401',
    });
    reader.close();
    expect(reader.state()).toEqual({ status: 'closed' });
  });

  it('drops a late answer for a page no longer asked for', async () => {
    let finishFirst: (page: ReadablePage) => void = () => undefined;
    const reader = setup(
      (url) =>
        new Promise((resolve) => {
          if (url === 'https://slow.com/') finishFirst = resolve;
          else resolve({ ...PAGE, url });
        }),
    );
    const slow = reader.open('https://slow.com/');
    await reader.open('https://fast.com/');
    finishFirst({ ...PAGE, url: 'https://slow.com/' });
    await slow;
    const state = reader.state();
    expect(state.status === 'ready' && state.page.url).toBe('https://fast.com/');
  });
});
