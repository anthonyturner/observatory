import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActiveVoice, Speaker } from './active-voice';
import { ANNOUNCEMENT_VOICE } from './announcement-voice';
import { SPEECH_ENGINES } from './chosen-engine';
import { LineClips } from './line-clips';
import { SpeakPreference } from './speak-preference';
import { FakeSpeechEngine } from './testing/fake-speech-engine';

async function settle(): Promise<void> {
  for (let i = 0; i < 30; i++) await Promise.resolve();
}

const KOKORO: Speaker = { engine: 'kokoro' };
const eleven = (id: string): Speaker => ({ engine: 'elevenlabs', voice: { id, name: id } });

function setUp(options: { readonly speakOn?: boolean } = {}) {
  const kokoro = new FakeSpeechEngine();
  const elevenlabs = new FakeSpeechEngine();
  const speaker = signal<Speaker>(KOKORO);
  const isOn = signal(options.speakOn ?? true);
  const isBusy = signal(false);
  TestBed.configureTestingModule({
    providers: [
      { provide: SPEECH_ENGINES, useValue: { kokoro, elevenlabs } },
      { provide: ActiveVoice, useValue: { speaker } },
      { provide: SpeakPreference, useValue: { isOn } },
      {
        provide: ANNOUNCEMENT_VOICE,
        useValue: { announce: vi.fn(), announceClip: vi.fn(), isBusy },
      },
    ],
  });
  return { clips: TestBed.inject(LineClips), kokoro, elevenlabs, speaker, isOn, isBusy };
}

describe('LineClips', () => {
  it('has no clip the first time, makes it, and gives the same one after', async () => {
    const { clips, kokoro } = setUp();

    expect(clips.clipOf('Merged!')).toBeNull();
    await settle();

    const clip = clips.clipOf('Merged!');
    expect(clip).toEqual(kokoro.clip);
    expect(clips.clipOf('Merged!')).toBe(clip);
    expect(kokoro.said).toEqual(['Merged!']);
  });

  it('makes a line once, however often it is wanted before it is ready', async () => {
    const { clips, kokoro } = setUp();

    clips.clipOf('Merged!');
    clips.clipOf('Merged!');
    clips.prepare(['Merged!', 'Resolved!']);
    await settle();

    expect(kokoro.said).toEqual(['Merged!', 'Resolved!']);
  });

  it('joins a line cut into several pieces back into one clip', async () => {
    const { clips, kokoro } = setUp();

    clips.prepare(['Closed. Into the dark it goes.']);
    await settle();

    expect(kokoro.said).toEqual(['Closed.', 'Into the dark it goes.']);
    expect(clips.clipOf('Closed. Into the dark it goes.')?.audio).toHaveLength(2);
  });

  it('never asks to download the voice model, and makes nothing while it is not ready', async () => {
    const { clips, kokoro } = setUp();
    kokoro.warmUpAnswer = 'unready';

    clips.prepare(['Merged!']);
    await settle();

    expect(kokoro.warmUpRequests.map((request) => request.mayAsk)).toEqual([false]);
    expect(kokoro.said).toEqual([]);
    expect(clips.clipOf('Merged!')).toBeNull();
  });

  it('makes nothing with Speak off, or while a line is being read', async () => {
    const { clips, kokoro, isOn, isBusy } = setUp({ speakOn: false });
    clips.prepare(['Merged!']);
    await settle();
    isOn.set(true);
    isBusy.set(true);
    clips.prepare(['Merged!']);
    await settle();

    expect(kokoro.warmUps).toBe(0);
    expect(clips.clipOf('Merged!')).toBeNull();

    isBusy.set(false);
    clips.prepare(['Merged!']);
    await settle();
    expect(clips.clipOf('Merged!')).not.toBeNull();
  });

  it('drops a line the engine cannot make, and tries again when it is wanted again', async () => {
    const { clips, kokoro } = setUp();
    kokoro.failure = new Error('no sound');

    clips.prepare(['Merged!']);
    await settle();
    expect(clips.clipOf('Merged!')).toBeNull();
    await settle();

    kokoro.failure = null;
    clips.prepare(['Merged!']);
    await settle();
    expect(clips.clipOf('Merged!')).not.toBeNull();
  });

  it('keeps a clip for the voice that made it, and makes the line again for another', async () => {
    const { clips, kokoro, elevenlabs, speaker } = setUp();
    clips.prepare(['Merged!']);
    await settle();
    expect(clips.clipOf('Merged!')).not.toBeNull();

    speaker.set(eleven('rachel'));
    expect(clips.clipOf('Merged!')).toBeNull();
    await settle();
    expect(clips.clipOf('Merged!')).not.toBeNull();
    expect(elevenlabs.said).toEqual(['Merged!']);

    speaker.set(eleven('adam'));
    expect(clips.clipOf('Merged!')).toBeNull();
    speaker.set(KOKORO);
    expect(clips.clipOf('Merged!')).not.toBeNull();
    expect(kokoro.said).toEqual(['Merged!']);
  });

  it('says which voice would make a clip, so its lines can be made again when it changes', () => {
    const { clips, speaker } = setUp();

    expect(clips.speaker()).toBe('kokoro');
    speaker.set(eleven('rachel'));
    expect(clips.speaker()).toBe('elevenlabs:rachel');
  });
});
