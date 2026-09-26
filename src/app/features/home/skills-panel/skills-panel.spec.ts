import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ASSISTANT_API, AssistantApi } from '../../../core/assistant/assistant-api';
import { AssistantStatus, RouteReply, Skill } from '../../../core/assistant/assistant.types';
import { SKILLS_SHOWN, SkillsPanel } from './skills-panel';

const skills = (count: number): Skill[] =>
  Array.from({ length: count }, (_, index) => ({ id: `s${index}`, label: `Skill ${index}` }));

async function render(status: () => Promise<AssistantStatus>) {
  const api: AssistantApi = {
    status: vi.fn(status),
    route: vi.fn(() => new Promise<RouteReply>(() => undefined)),
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ASSISTANT_API, useValue: api },
    ],
  });
  const fixture = TestBed.createComponent(SkillsPanel);
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
});
