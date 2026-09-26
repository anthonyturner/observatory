import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ASSISTANT_API, AssistantApi } from '../../../core/assistant/assistant-api';
import { AssistantStatus, RouteReply, Skill } from '../../../core/assistant/assistant.types';
import { ReplyFocus } from '../../../core/assistant/reply-focus';
import { ReplyLog } from '../../../core/assistant/reply-log';
import { SKILLS_SHOWN, SkillsPanel } from './skills-panel';

const skills = (count: number): Skill[] =>
  Array.from({ length: count }, (_, index) => ({ id: `s${index}`, label: `Skill ${index}` }));

async function render(
  status: () => Promise<AssistantStatus>,
  route: () => Promise<RouteReply> = () => new Promise<RouteReply>(() => undefined),
) {
  const api: AssistantApi = { status: vi.fn(status), route: vi.fn(route) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ASSISTANT_API, useValue: api },
    ],
  });
  const fixture = TestBed.createComponent(SkillsPanel);
  document.body.append(fixture.nativeElement as HTMLElement);
  await fixture.whenStable();
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const tiles = () => element.querySelectorAll('app-skill-tile').length;
  return { fixture, element, tiles, api };
}

const known = (list: Skill[]) => async (): Promise<AssistantStatus> => ({
  jev: 'on',
  where: 'local',
  skills: list,
});

describe('SkillsPanel', () => {
  afterEach(() => document.body.replaceChildren());

  it('shows the first few, then browses all and folds them again', async () => {
    const { fixture, element, tiles } = await render(known(skills(SKILLS_SHOWN + 2)));
    const toggle = element.querySelector<HTMLButtonElement>('.browse button');
    expect(tiles()).toBe(SKILLS_SHOWN);
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');

    toggle?.click();
    fixture.detectChanges();
    expect(tiles()).toBe(SKILLS_SHOWN + 2);
    expect(toggle?.textContent).toContain('Show fewer skills');

    toggle?.click();
    fixture.detectChanges();
    expect(tiles()).toBe(SKILLS_SHOWN);
  });

  it('has nothing to browse when every skill fits', async () => {
    const { element, tiles } = await render(known(skills(2)));

    expect(tiles()).toBe(2);
    expect(element.querySelector('.browse button')).toBeNull();
    expect(element.querySelector('.browse b')?.textContent).toBe('2');
  });

  it('says there are no skills yet only when the router says so', async () => {
    const { element } = await render(known([]));

    expect(element.querySelector('.empty')?.textContent).toContain('No skills yet');
    expect(element.querySelector('.browse')?.classList.contains('none')).toBe(true);
  });

  it('says the skills did not load, and tries again', async () => {
    const { fixture, element, api } = await render(() => Promise.reject(new Error('offline')));
    expect(element.querySelector('.lost')?.textContent).toContain('Skills didn’t load');
    expect(element.querySelector('.browse b')?.textContent).toBe('unknown');

    element.querySelector<HTMLButtonElement>('.lost button')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api.status).toHaveBeenCalledTimes(2);
    expect(element.querySelector('.lost')?.textContent).toContain('Still no answer');
  });

  it('proposes a skill when its tile is pressed', async () => {
    const { element, api } = await render(known(skills(1)));

    element.querySelector<HTMLButtonElement>('app-skill-tile button')?.click();

    expect(api.route).toHaveBeenCalledWith({ skill: 's0' });
  });

  it('takes the focus to the reply’s first choice while the tile still has it', async () => {
    const whichProject: RouteReply = {
      tier: 3,
      ask: [{ label: 'app', pick: { project: 'app' } }],
      commands: [],
    };
    const { fixture, element } = await render(known(skills(2)), async () => whichProject);
    const tile = element.querySelector<HTMLButtonElement>('app-skill-tile button');

    tile?.focus();
    tile?.click();
    await fixture.whenStable();

    const latest = TestBed.inject(ReplyLog).entries()[0];
    expect(TestBed.inject(ReplyFocus).firstAction()).toEqual({ entryId: latest.id });
  });

  it('leaves the focus alone once it has moved off the tile', async () => {
    let answer: (reply: RouteReply) => void = () => undefined;
    const { fixture, element } = await render(
      known(skills(2)),
      () => new Promise<RouteReply>((resolve) => (answer = resolve)),
    );
    const [first, second] = element.querySelectorAll<HTMLButtonElement>('app-skill-tile button');

    first.focus();
    first.click();
    second.focus();
    answer({ tier: 3, ask: [{ label: 'app', pick: {} }], commands: [] });
    await fixture.whenStable();

    expect(TestBed.inject(ReplyFocus).firstAction()).toBeNull();
  });

  it('gives Try again the focus back while the skills still do not load', async () => {
    const { fixture, element } = await render(() => Promise.reject(new Error('offline')));
    const retry = element.querySelector<HTMLButtonElement>('.lost button');

    retry?.focus();
    retry?.click();
    await fixture.whenStable();

    expect(document.activeElement).toBe(element.querySelector('.lost button'));
  });

  it('takes the focus to the first skill once they load', async () => {
    let loads = 0;
    const { fixture, element } = await render(() =>
      loads++ === 0 ? Promise.reject(new Error('offline')) : known(skills(2))(),
    );

    element.querySelector<HTMLButtonElement>('.lost button')?.click();
    await fixture.whenStable();

    expect(document.activeElement).toBe(element.querySelector('app-skill-tile button'));
  });
});
