import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ANNOUNCEMENT_VOICE } from '../voice/announcement-voice';
import { TalkState } from '../voice/talk-state';
import { ASK_CHANNEL } from './ask-channel';
import { JevIdle } from './jev-idle';
import { OpenQuestion } from './open-question';
import { ProposalSlot, commandProposalOf } from './proposal';

function setUp() {
  const isBusy = signal(false);
  const asking = signal(false);
  TestBed.configureTestingModule({
    providers: [
      {
        provide: ANNOUNCEMENT_VOICE,
        useValue: { announce: vi.fn(), announceClip: vi.fn(), isBusy },
      },
      { provide: ASK_CHANNEL, useValue: { submit: () => undefined, busy: asking } },
    ],
  });
  return {
    idle: TestBed.inject(JevIdle).isIdle,
    isBusy,
    asking,
    talk: TestBed.inject(TalkState),
    slot: TestBed.inject(ProposalSlot),
    question: TestBed.inject(OpenQuestion),
  };
}

describe('JevIdle', () => {
  it('is idle when Jev has nothing on', () => {
    expect(setUp().idle()).toBe(true);
  });

  it('is not while a line is being read, a request is on its way or the mic is held', () => {
    const { idle, isBusy, asking, talk } = setUp();

    isBusy.set(true);
    expect(idle()).toBe(false);
    isBusy.set(false);
    asking.set(true);
    expect(idle()).toBe(false);
    asking.set(false);
    talk.begin();
    expect(idle()).toBe(false);
    talk.end();
    expect(idle()).toBe(true);
  });

  it('is not while a task is shown, or a question waits for its answer', () => {
    const { idle, slot, question } = setUp();

    slot.show(
      commandProposalOf(
        { tier: 3, ask: [], commands: [{ shell: 'bash', command: 'npm test' }] },
        'local',
        1,
      ),
    );
    expect(idle()).toBe(false);
    slot.dismiss();
    question.ask('Open them?', []);
    expect(idle()).toBe(false);
    question.close();
    expect(idle()).toBe(true);
  });
});
