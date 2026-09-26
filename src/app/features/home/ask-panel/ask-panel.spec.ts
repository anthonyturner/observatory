import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AskFeed } from '../../../core/assistant/ask-feed';
import { ASSISTANT_API, AssistantApi } from '../../../core/assistant/assistant-api';
import { AssistantStatus, RouteReply } from '../../../core/assistant/assistant.types';
import { AskPanel, REPLIES_SHOWN } from './ask-panel';

const LOCAL: AssistantStatus = { jev: 'on', where: 'local', skills: [] };

async function render(options: { status?: AssistantStatus; reply?: RouteReply } = {}) {
  const api: AssistantApi = {
    status: async () => options.status ?? LOCAL,
    route: async () => options.reply ?? { tier: 2, text: 'An answer', ask: [], commands: [] },
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
      },
    });

    TestBed.inject(AskFeed).submit('fix the build');
    await refresh();

    const card = element.querySelector('app-proposal-card');
    expect(card?.querySelector('h3')?.textContent).toContain('Run this as a Claude Code task');
    expect(card?.querySelector('pre')?.textContent).toBe('claude -p "fix it"');
    expect(card?.textContent).toContain('Copy command');
  });

  it('gives a visitor one line in place of the Ask box', async () => {
    const { element, refresh, http } = await render();

    http.expectOne('/api/session').flush({ access: 'visitor', signIn: '/api/auth/login' });
    await refresh();

    expect(element.querySelector('app-ask-bar')).toBeNull();
    expect(element.querySelector('.preview-note')?.textContent).toContain(
      'The assistant belongs to the owner.',
    );
    expect(element.querySelector('.preview-note a')?.getAttribute('href')).toContain(
      '/api/auth/login?next=',
    );
  });
});
