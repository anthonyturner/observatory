import { TestBed } from '@angular/core/testing';
import { PAGE_READER, PageReader, Reader } from '../../../core/reader/reader-service';
import { ReadablePage } from '../../../core/reader/reader.types';
import { ReaderWindow } from './reader-window';

const PAGE: ReadablePage = {
  url: 'https://example.com/a',
  title: 'Nvidia buys Hugging Face',
  site: 'Example News',
  published: '2026-09-26T10:00:00Z',
  image: 'https://example.com/lead.jpg',
  blocks: [
    { kind: 'paragraph', text: 'Nvidia agreed to buy Hugging Face.' },
    { kind: 'heading', text: 'Why it matters' },
    { kind: 'item', text: 'It consolidates open-source AI.' },
  ],
  canEmbed: false,
  isThin: false,
};

describe('ReaderWindow', () => {
  async function render(read: PageReader) {
    TestBed.configureTestingModule({ providers: [{ provide: PAGE_READER, useValue: read }] });
    const fixture = TestBed.createComponent(ReaderWindow);
    document.body.append(fixture.nativeElement as HTMLElement);
    const reader = TestBed.inject(Reader);
    const element = fixture.nativeElement as HTMLElement;
    const open = async (url = PAGE.url) => {
      await reader.open(url);
      await fixture.whenStable();
    };
    return { fixture, element, reader, open };
  }

  afterEach(() => document.body.replaceChildren());

  it('shows nothing until a page is opened', async () => {
    const { element } = await render(async () => PAGE);
    expect(element.querySelector('[role="dialog"]')).toBeNull();
  });

  it('shows the page’s readable text, its site, and a way out to the browser', async () => {
    const { element, open } = await render(async () => PAGE);
    await open();

    expect(element.querySelector('.title')?.textContent).toBe('Nvidia buys Hugging Face');
    expect(element.querySelector('.site')?.textContent).toBe('Example News');
    expect(element.querySelector('h3')?.textContent).toBe('Why it matters');
    expect(element.querySelectorAll('.body p')).toHaveLength(2);
    expect(element.querySelector('img')?.getAttribute('src')).toBe('https://example.com/lead.jpg');
    const out = element.querySelector<HTMLAnchorElement>('.out');
    expect(out?.getAttribute('href')).toBe(PAGE.url);
    expect(out?.getAttribute('rel')).toContain('noopener');
  });

  it('offers the live page only where the site allows framing, sandboxed', async () => {
    const { element, open, fixture } = await render(async () => ({ ...PAGE, canEmbed: true }));
    await open();
    const pageButton = Array.from(
      element.querySelectorAll<HTMLButtonElement>('.views button'),
    ).find((button) => button.textContent?.trim() === 'Page');
    pageButton?.click();
    await fixture.whenStable();

    const frame = element.querySelector('iframe');
    expect(frame?.getAttribute('sandbox')).toBe('allow-scripts allow-popups allow-forms');
  });

  it('has no Page view for a site that forbids framing', async () => {
    const { element, open } = await render(async () => PAGE);
    await open();
    expect(element.querySelector('.views')).toBeNull();
  });

  it('says why a page could not be read', async () => {
    const { element, open } = await render(async () => ({ failed: 'the site answered 401' }));
    await open();
    expect(element.querySelector('.title')?.textContent).toContain('Couldn’t read this page');
    expect(element.textContent).toContain('the site answered 401');
  });

  it('says when a page is thin', async () => {
    const { element, open } = await render(async () => ({ ...PAGE, isThin: true }));
    await open();
    expect(element.textContent).toContain('without a sign-in');
  });

  it('closes with × and with Esc', async () => {
    const { element, open, fixture, reader } = await render(async () => PAGE);
    await open();
    element.querySelector<HTMLButtonElement>('.close')?.click();
    await fixture.whenStable();
    expect(reader.state().status).toBe('closed');

    await open();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(element.querySelector('[role="dialog"]')).toBeNull();
  });
});
