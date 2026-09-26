import { TestBed } from '@angular/core/testing';
import { ReplyEntry, noting, waitingEntry } from '../../../core/assistant/reply-entry';
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
});
