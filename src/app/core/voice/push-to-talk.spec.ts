import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ASK_CHANNEL } from '../assistant/ask-channel';
import { DownloadConsent } from './download-consent';
import { MICROPHONE, MicRecording, MicStream, Microphone } from './microphone';
import { ModelLoader } from './model-loader';
import { LISTEN_PATHS } from './model-paths';
import { TALK_CLOCK, PushToTalk } from './push-to-talk';
import { REPLY_VOICE, ReplyVoice } from './reply-voice';
import { SpeakSwitch } from './speak-switch';
import { TalkState } from './talk-state';
import { Transcriber } from './transcriber';
import { VoiceError } from './voice-error';
import { NEXT_FRAME } from './voice-level';
import { VoiceNarration } from './voice-narration';
import { VoiceStatus } from './voice-status';

class FakeRecording implements MicRecording {
  isDiscarded = false;
  isFinished = false;
  constructor(readonly onCut: () => void) {}
  level(): number {
    return 0.5;
  }
  finish(): Promise<Blob> {
    this.isFinished = true;
    return Promise.resolve(new Blob(['voice']));
  }
  discard(): void {
    this.isDiscarded = true;
  }
}

class FakeMicrophone implements Microphone {
  recordings: FakeRecording[] = [];
  refusal: Error | null = null;
  canRecord(): boolean {
    return true;
  }
  isSecure(): boolean {
    return true;
  }
  async open(): Promise<MicStream> {
    if (this.refusal) throw this.refusal;
    return {
      record: (onCut) => {
        const recording = new FakeRecording(onCut);
        this.recordings.push(recording);
        return recording;
      },
      close: () => undefined,
    };
  }
}

/** Lets every pending promise run. */
async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

function setup(options: { isCached?: boolean; heard?: string | null } = {}) {
  let now = 0;
  const mic = new FakeMicrophone();
  const busy = signal(false);
  const submit = vi.fn();
  const stop = vi.fn(() => false);
  const ask = vi.fn(async () => undefined);
  const failures = new Subject<VoiceError>();
  const model: Partial<ModelLoader> = {
    isLoading: () => false,
    isLoaded: () => true,
    isCached: async () => options.isCached ?? true,
    load: async () => undefined,
    forget: () => undefined,
    hasFallenBack: () => false,
    currentPath: () => LISTEN_PATHS.cpu,
  };
  const transcribe = vi.fn(async () => (options.heard === undefined ? 'hello' : options.heard));
  const replyVoice: ReplyVoice = { speak: async () => undefined, stop, speaking: signal(false) };
  TestBed.configureTestingModule({
    providers: [
      { provide: MICROPHONE, useValue: mic },
      { provide: TALK_CLOCK, useValue: () => now },
      { provide: NEXT_FRAME, useValue: () => undefined },
      { provide: ASK_CHANNEL, useValue: { submit, busy } },
      { provide: REPLY_VOICE, useValue: replyVoice },
      { provide: SpeakSwitch, useValue: { wake: () => undefined } },
      { provide: DownloadConsent, useValue: { ask } },
      { provide: Transcriber, useValue: { model, failures, transcribe } },
    ],
  });
  return {
    talk: TestBed.inject(PushToTalk),
    narration: TestBed.inject(VoiceNarration),
    status: TestBed.inject(VoiceStatus),
    isTalking: TestBed.inject(TalkState).isTalking,
    mic,
    submit,
    stop,
    ask,
    busy,
    failures,
    transcribe,
    wait: (ms: number) => (now += ms),
  };
}

describe('PushToTalk', () => {
  it('records while held and sends what it heard when let go', async () => {
    const { talk, submit, wait, isTalking } = setup();
    await talk.press('hold');
    expect(talk.isRecording()).toBe(true);
    expect(isTalking()).toBe(true);
    wait(1200);
    talk.release();
    await settle();
    expect(talk.isRecording()).toBe(false);
    expect(submit).toHaveBeenCalledWith('hello', { spoken: true });
    expect(isTalking()).toBe(false);
  });

  it('keeps listening after a short tap, until the next press', async () => {
    const { talk, submit, wait, narration } = setup();
    await talk.press('hold');
    wait(100);
    talk.release();
    await settle();
    expect(talk.isRecording()).toBe(true);
    expect(narration.said()?.words).toBe('Listening. Press again to stop');
    expect(submit).not.toHaveBeenCalled();

    await talk.press('hold');
    await settle();
    expect(submit).toHaveBeenCalledWith('hello', { spoken: true });
  });

  it('toggles from the keyboard: one press starts, the next sends', async () => {
    const { talk, submit } = setup();
    await talk.press('toggle');
    expect(talk.isRecording()).toBe(true);
    await talk.press('toggle');
    await settle();
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('cuts off a reply being read aloud', async () => {
    const { talk, stop } = setup();
    await talk.press('hold');
    expect(stop).toHaveBeenCalled();
  });

  it('throws the recording away on Esc, and sends nothing', async () => {
    const { talk, mic, submit, narration, wait } = setup();
    await talk.press('hold');
    expect(talk.discard()).toBe(true);
    expect(mic.recordings[0].isDiscarded).toBe(true);
    expect(talk.isRecording()).toBe(false);
    expect(narration.said()?.words).toBe('Threw the recording away.');
    wait(1000);
    talk.release();
    await settle();
    expect(submit).not.toHaveBeenCalled();
    expect(talk.discard()).toBe(false);
  });

  it('says it heard nothing when the clip held no words', async () => {
    const { talk, submit, narration, wait } = setup({ heard: null });
    await talk.press('hold');
    wait(1000);
    talk.release();
    await settle();
    expect(submit).not.toHaveBeenCalled();
    expect(narration.said()?.words).toBe('Heard nothing. Try again, closer to the mic.');
  });

  it('uses what a recording caught when the microphone cuts it off', async () => {
    const { talk, mic, submit, narration } = setup();
    await talk.press('hold');
    mic.recordings[0].onCut();
    await settle();
    expect(submit).toHaveBeenCalledWith('hello', { spoken: true });
    expect(narration.said()?.words).toBe(
      'The microphone stopped, so Home used what it heard until then.',
    );
  });

  it('waits for a request already on its way before sending', async () => {
    const { talk, submit, busy, wait } = setup();
    busy.set(true);
    await talk.press('hold');
    wait(1000);
    talk.release();
    await settle();
    expect(submit).not.toHaveBeenCalled();
    busy.set(false);
    TestBed.tick();
    await settle();
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('asks before the first download instead of recording', async () => {
    const { talk, ask, mic } = setup({ isCached: false });
    await talk.press('hold');
    expect(ask).toHaveBeenCalledTimes(1);
    expect(mic.recordings).toHaveLength(0);
    expect(talk.isRecording()).toBe(false);
  });

  it('says why when the browser refuses the microphone', async () => {
    const { talk, mic, status } = setup();
    mic.refusal = new DOMException('no', 'NotAllowedError');
    await talk.press('hold');
    expect(talk.isBlocked()).toBe(true);
    expect(status.line()?.isTrouble).toBe(true);
    expect(status.line()?.words).toContain('Microphone blocked for this site');
  });

  it('drops a recording when the model fails, and offers to try again', async () => {
    const { talk, mic, failures, status, submit } = setup();
    await talk.press('hold');
    failures.next(new VoiceError('offline', 'download'));
    expect(mic.recordings[0].isDiscarded).toBe(true);
    expect(talk.isBlocked()).toBe(true);
    expect(status.line()?.words).toBe('Couldn’t download the speech model. Check the connection.');
    expect(status.line()?.actions.map((action) => action.label)).toEqual(['Try again']);
    await talk.press('hold');
    expect(mic.recordings).toHaveLength(1);
    status.line()?.actions[0].run();
    expect(talk.isBlocked()).toBe(false);
    expect(submit).not.toHaveBeenCalled();
  });
});
