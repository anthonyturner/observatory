import { TestBed } from '@angular/core/testing';
import { ReplyEntry, answering, noting, waitingEntry } from '../../../core/assistant/reply-entry';
import { ReplyEntryCard } from './reply-entry';

const OPTIONS: ReplyEntry = {
  ...waitingEntry(7, 'find stale PRs', 'skill'),
  said: noting('Which project?'),
  actions: [
    { kind: 'send', label: 'app', request: { skill: 'stale', pick: { project: 'app' } } },
    { kind: 'neither' },
  ],
};

describe('ReplyEntryCard', () => {
  async function render() {
    const fixture = TestBed.createComponent(ReplyEntryCard);
    fixture.componentRef.setInput('entry', OPTIONS);
    document.body.append(fixture.nativeElement as HTMLElement);
    await fixture.whenStable();
    const ask = async (entryId: number) => {
      fixture.componentRef.setInput('focusRequest', { entryId });
      await fixture.whenStable();
    };
    const first = (fixture.nativeElement as HTMLElement).querySelector('.acts button');
    return { fixture, ask, first };
  }

  afterEach(() => document.body.replaceChildren());

  it('takes the focus to its first button when asked', async () => {
    const { ask, first } = await render();

    await ask(OPTIONS.id);

    expect(document.activeElement).toBe(first);
  });

  it('leaves the focus when another reply is asked', async () => {
    const { ask, first } = await render();

    await ask(OPTIONS.id + 1);

    expect(document.activeElement).not.toBe(first);
  });

  it('lists a web answer’s sources as links that open in a new tab', async () => {
    const fixture = TestBed.createComponent(ReplyEntryCard);
    fixture.componentRef.setInput('entry', {
      ...waitingEntry(8, 'AI news', 'typed'),
      said: answering('New models shipped.', [{ title: 'Lab A', url: 'https://example.com/a' }]),
    });
    await fixture.whenStable();
    const links = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>(
      '.sources a',
    );

    expect(links).toHaveLength(1);
    expect(links[0].textContent?.trim()).toBe('Lab A');
    expect(links[0].getAttribute('href')).toBe('https://example.com/a');
    expect(links[0].getAttribute('target')).toBe('_blank');
    expect(links[0].getAttribute('rel')).toContain('noopener');
  });

  it('lists no sources for an answer without any', async () => {
    const fixture = TestBed.createComponent(ReplyEntryCard);
    fixture.componentRef.setInput('entry', {
      ...waitingEntry(9, 'x', 'typed'),
      said: answering('Hi.'),
    });
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('.sources')).toBeNull();
  });
});
