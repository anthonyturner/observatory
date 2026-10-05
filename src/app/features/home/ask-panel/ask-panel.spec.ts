import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AskFeed, ELSEWHERE } from '../../../core/assistant/ask-feed';
import { ASSISTANT_API, AssistantApi } from '../../../core/assistant/assistant-api';
import { Conversation } from '../../../core/assistant/conversation';
import { OpenItem } from '../../../core/assistant/open-items';
import { OpenQuestion, QUESTION_MS, TIMED_OUT_NOTE } from '../../../core/assistant/open-question';
import { AssistantStatus, RouteReply } from '../../../core/assistant/assistant.types';
import { AskPanel, REPLIES_SHOWN } from './ask-panel';

const LOCAL: AssistantStatus = { jev: 'on', where: 'local', skills: [] };

async function render(options: { status?: AssistantStatus; reply?: RouteReply } = {}) {
  const api: AssistantApi = {
    status: async () => options.status ?? LOCAL,
    route: async () =>
      options.reply ?? { tier: 2, text: 'An answer', ask: [], commands: [], sources: [] },
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ASSISTANT_API, useValue: api },
    ],
  });
  const fixture = TestBed.createComponent(AskPanel);
  await fixture.whenStable();
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const refresh = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { fixture, element, refresh, http: TestBed.inject(HttpTestingController) };
}

describe('AskPanel', () => {
  it('holds the voice controls, then the ask bar', async () => {
    const { element } = await render();
    const parts = Array.from(element.querySelectorAll('app-voice-controls, app-ask-bar')).map(
      (part) => part.tagName.toLowerCase(),
    );

    expect(parts).toEqual(['app-voice-controls', 'app-ask-bar']);
  });

  it('draws a level line of dashes, each with its own share of the level', async () => {
    const dashes = (await render()).element.querySelectorAll<HTMLElement>('.level i');

    expect(dashes.length).toBe(36);
    expect(dashes[0].style.getPropertyValue('--k')).not.toBe('');
  });

  it('shows a reply under what was asked, newest first, folding the oldest into Earlier', async () => {
    const { element, refresh } = await render();
    const feed = TestBed.inject(AskFeed);

    for (let n = 1; n <= REPLIES_SHOWN + 1; n++) {
      feed.submit(`question ${n}`);
      await refresh();
    }

    const shown = element.querySelectorAll('.replies > ol > li');
    expect(shown.length).toBe(REPLIES_SHOWN);
    expect(shown[0].textContent).toContain(`question ${REPLIES_SHOWN + 1}`);
    expect(shown[0].textContent).toContain('An answer');
    expect(element.querySelector('.earlier summary')?.textContent).toBe('Earlier (1)');
  });

  it('says Jev is off, with a way to turn it on', async () => {
    const { element } = await render({ status: { ...LOCAL, jev: 'off' } });

    expect(element.querySelector('.jev-off')?.textContent).toContain('Jev is off');
    expect(element.querySelector('.jev-off code')?.textContent).toBe('OPENROUTER_API_KEY');
  });

  it('shows a proposal as its command to copy', async () => {
    const { element, refresh } = await render({
      reply: {
        tier: 3,
        project: 'app',
        commands: [{ shell: 'bash', command: 'claude -p "fix it"' }],
        ask: [],
        sources: [],
      },
    });

    TestBed.inject(AskFeed).submit('fix the build');
    await refresh();

    const card = element.querySelector('app-proposal-card');
    expect(card?.querySelector('h3')?.textContent).toContain('Run this as a Claude Code task');
    expect(card?.querySelector('pre')?.textContent).toBe('claude -p "fix it"');
    expect(card?.textContent).toContain('Copy command');
  });

  it('offers New conversation once there is one, and clears it', async () => {
    const { element, refresh } = await render();
    const button = () => element.querySelector<HTMLButtonElement>('button.new-conversation');
    expect(button()).toBeNull();

    TestBed.inject(AskFeed).submit('hello');
    await refresh();
    button()?.click();
    await refresh();

    expect(TestBed.inject(Conversation).hasTurns()).toBe(false);
    expect(button()).toBeNull();
    expect(element.querySelector('.replies')?.textContent).toContain('An answer');
  });

  describe('Jev’s question', () => {
    const ITEMS: readonly OpenItem[] = [
      {
        kind: 'pull',
        repo: 'me/app',
        label: 'app',
        number: 12,
        title: 'Fix the bar',
        href: '/p/me/app?pr=12',
      },
      {
        kind: 'issue',
        repo: 'me/app',
        label: 'app',
        number: 7,
        title: 'Bar stutters',
        href: '/p/me/app?issue=7',
      },
    ];
    const ask = async (refresh: () => Promise<void>) => {
      const question = TestBed.inject(OpenQuestion);
      question.ask('Would you like to open any of them?', ITEMS);
      await refresh();
      return question;
    };
    const card = (element: HTMLElement) => element.querySelector('app-question-card');

    it('lists each open item with Open, and No thanks, under the question', async () => {
      const { element, refresh } = await render();
      await ask(refresh);

      const rows = Array.from(card(element)?.querySelectorAll('li') ?? []);
      expect(card(element)?.querySelector('h3')?.textContent).toBe(
        'Would you like to open any of them?',
      );
      expect(rows.map((row) => row.querySelector('.where')?.textContent)).toEqual([
        'app #12',
        'app #7',
      ]);
      expect(rows[0].querySelector('button')?.getAttribute('aria-label')).toBe(
        'Open pull request 12 in app: Fix the bar',
      );
      expect(card(element)?.querySelector('.acts button')?.textContent?.trim()).toBe('No thanks');
    });

    it('goes to the item at once on Open', async () => {
      const { element, refresh } = await render();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      await ask(refresh);

      card(element)?.querySelectorAll<HTMLButtonElement>('li button')[1].click();
      await refresh();

      expect(navigate).toHaveBeenCalledExactlyOnceWith('/p/me/app?issue=7');
      expect(card(element)).toBeNull();
    });

    it('goes on No thanks, going nowhere', async () => {
      const { element, refresh } = await render();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      await ask(refresh);

      card(element)?.querySelector<HTMLButtonElement>('.acts button')?.click();
      await refresh();

      expect(card(element)).toBeNull();
      expect(navigate).not.toHaveBeenCalled();
    });

    it('says it timed out, with nothing left to open', async () => {
      const { element, refresh } = await render();
      vi.useFakeTimers();
      TestBed.inject(OpenQuestion).ask('Would you like to open any of them?', ITEMS);

      vi.advanceTimersByTime(QUESTION_MS);
      vi.useRealTimers();
      await refresh();

      expect(card(element)?.querySelector('.note')?.textContent).toBe(TIMED_OUT_NOTE);
      expect(card(element)?.querySelector('li')).toBeNull();
    });

    it('can be asked only while the panel is on screen, and closes when it goes', async () => {
      const { fixture, refresh } = await render();
      const question = await ask(refresh);
      expect(question.canAsk()).toBe(true);

      fixture.destroy();

      expect(question.canAsk()).toBe(false);
      expect(question.question()).toBeNull();
    });
  });

  it('has no Ask box on the hosted site, even for the owner, only one line', async () => {
    for (const access of ['owner', 'visitor'] as const) {
      TestBed.resetTestingModule();
      const { element, refresh, http } = await render();

      http.expectOne('/api/session').flush({ access, signIn: '/api/auth/login' });
      await refresh();

      expect(element.querySelector('app-ask-bar')).toBeNull();
      expect(element.querySelector('app-voice-controls')).toBeNull();
      expect(element.querySelector('.preview-note')?.textContent).toContain(ELSEWHERE);
    }
  });
});
