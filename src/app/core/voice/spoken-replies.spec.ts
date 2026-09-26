import { TestBed } from '@angular/core/testing';
import { SpeakPreference } from './speak-preference';
import { SpeakerOutput } from './speaker-output';
import { SPEECH_ENGINE, SpeechEngine, WarmUp } from './speech-engine';
import { SpokenReplies } from './spoken-replies';
import { TalkState } from './talk-state';
import { VoiceError } from './voice-error';
import { NEXT_FRAME } from './voice-level';
import { SpokenClip } from './voice-protocol';
import { VoiceStatus } from './voice-status';

/** The few Web Audio parts a reply uses, keeping what was started when. */
class FakeSource {
  buffer: { duration: number } | null = null;
  onended: (() => void) | null = null;
  startedAt: number | null = null;
  stoppedAt: number | null = null;
  connect(): void {
    return;
  }
  start(at: number): void {
    this.startedAt = at;
  }
  stop(at: number): void {
    this.stoppedAt = at;
  }
}

class FakeContext {
  currentTime = 0;
  readonly sources: FakeSource[] = [];
  createGain() {
    return {
      gain: { setTargetAtTime: () => undefined },
      connect: () => undefined,
      disconnect: () => undefined,
    };
  }
  createBuffer(_channels: number, length: number, rate: number) {
    return { duration: length / rate, copyToChannel: () => undefined };
  }
  createBufferSource(): FakeSource {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }
}

/** One second of sound. */
const SECOND: SpokenClip = { audio: new Float32Array(10), rate: 10 };

class FakeEngine implements SpeechEngine {
  warmUpAnswer: WarmUp = 'ready';
  failure: VoiceError | null = null;
  readonly said: string[] = [];
  released = 0;
  async warmUp(): Promise<WarmUp> {
    return this.warmUpAnswer;
  }
  async synthesize(sentence: string): Promise<SpokenClip> {
    if (this.failure) throw this.failure;
    this.said.push(sentence);
    return SECOND;
  }
  release(): void {
    this.released++;
  }
}

async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

function setup() {
  localStorage.setItem('observatory.speak', 'on');
  const context = new FakeContext();
  const engine = new FakeEngine();
  TestBed.configureTestingModule({
    providers: [
      { provide: SPEECH_ENGINE, useValue: engine },
      { provide: NEXT_FRAME, useValue: () => undefined },
      {
        provide: SpeakerOutput,
        useValue: {
          ready: async () => ({ context, input: {} }),
          level: () => 0.4,
          wake: () => undefined,
        },
      },
    ],
  });
  return {
    replies: TestBed.inject(SpokenReplies),
    status: TestBed.inject(VoiceStatus),
    talk: TestBed.inject(TalkState),
    context,
    engine,
  };
}

/** Plays out every sentence started so far. */
function hearAll(context: FakeContext): void {
  context.sources.forEach((source) => source.onended?.());
}

describe('SpokenReplies', () => {
  afterEach(() => localStorage.clear());

  it('reads each sentence in turn, back to back, then settles', async () => {
    const { replies, context, engine } = setup();
    let settled = false;
    const spoken = replies.speak('First one. Second one.', 2).then(() => (settled = true));
    await settle();
    expect(engine.said).toEqual(['First one.', 'Second one.']);
    expect(replies.speaking()).toBe(true);
    expect(replies.tier()).toBe(2);
    const [first, second] = context.sources;
    expect(second.startedAt).toBeCloseTo((first.startedAt ?? 0) + 1);
    expect(settled).toBe(false);

    hearAll(context);
    await spoken;
    expect(replies.speaking()).toBe(false);
  });

  it('cuts a reply off at once, and says something was cut', async () => {
    const { replies, context } = setup();
    const spoken = replies.speak('One. Two.', 1);
    await settle();
    expect(replies.stop()).toBe(true);
    await spoken;
    expect(context.sources.every((source) => source.stoppedAt !== null)).toBe(true);
    expect(replies.speaking()).toBe(false);
    expect(replies.stop()).toBe(false);
  });

  it('cuts off the reply before when a new one comes', async () => {
    const { replies, context, engine } = setup();
    const first = replies.speak('Old news.', 1);
    await settle();
    void replies.speak('New news.', 2);
    await first;
    await settle();
    expect(context.sources[0].stoppedAt).not.toBeNull();
    expect(engine.said).toEqual(['Old news.', 'New news.']);
    expect(replies.tier()).toBe(2);
  });

  it('stays quiet while the mic is open, or Speak is off', async () => {
    const { replies, engine, talk } = setup();
    talk.begin();
    await replies.speak('Hello.', 1);
    talk.end();
    TestBed.inject(SpeakPreference).turnOff();
    await replies.speak('Hello.', 1);
    expect(engine.said).toEqual([]);
  });

  it('turns Speak off for this visit when the voice must download first', async () => {
    const { replies, engine } = setup();
    engine.warmUpAnswer = 'asked';
    await replies.speak('Hello.', 1);
    expect(engine.said).toEqual([]);
    expect(localStorage.getItem('observatory.speak')).toBe('on');
    await replies.speak('Again.', 1);
    expect(engine.said).toEqual([]);
  });

  it('says why a reply went unheard', async () => {
    const { replies, engine, status } = setup();
    engine.failure = new VoiceError('slow', 'model');
    await replies.speak('Hello.', 1);
    expect(status.line()?.words).toBe(
      'The voice model is still loading, so that reply was not spoken.',
    );
    expect(status.line()?.isTrouble).toBe(false);

    engine.failure = new VoiceError('broke', 'device');
    await replies.speak('Hello.', 1);
    expect(status.line()?.isTrouble).toBe(true);
  });
});
