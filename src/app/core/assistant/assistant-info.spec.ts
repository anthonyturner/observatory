import { TestBed } from '@angular/core/testing';
import { ASSISTANT_API, AssistantApi, AssistantAbsent } from './assistant-api';
import { AssistantStatus } from './assistant.types';
import { AssistantInfo } from './assistant-info';

const STATUS: AssistantStatus = {
  jev: 'on',
  where: 'local',
  skills: [{ id: 'stale', label: 'Find stale PRs' }],
};

function setUp(status: () => Promise<AssistantStatus>) {
  const api: AssistantApi = { status: vi.fn(status), route: vi.fn() };
  TestBed.configureTestingModule({ providers: [{ provide: ASSISTANT_API, useValue: api }] });
  return { info: TestBed.inject(AssistantInfo), api };
}

describe('AssistantInfo', () => {
  it('is loading until the router answers, then knows the skills', async () => {
    const { info } = setUp(async () => STATUS);
    expect(info.skills()).toEqual({ status: 'loading' });

    await info.load();

    expect(info.skills()).toEqual({ status: 'known', skills: STATUS.skills });
    expect(info.where()).toBe('local');
  });

  it('leaves the skills unknown, not none, when the router does not answer', async () => {
    const { info } = setUp(() => Promise.reject(new Error('offline')));

    await info.load();

    expect(info.skills()).toEqual({ status: 'lost' });
    expect(info.isElsewhere()).toBe(false);
  });

  it('marks an absent assistant as elsewhere', async () => {
    const { info } = setUp(() => Promise.reject(new AssistantAbsent('hosted')));

    await info.load();

    expect(info.isElsewhere()).toBe(true);
  });
});
