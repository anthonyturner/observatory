import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CaptureUnsupportedError, NoAudioError } from './audio-tap';
import { MEDIA_DEVICES } from './media-devices';
import { MicrophoneSoundSource } from './microphone-sound-source';
import { SOUND_CARD_AVAILABLE } from './sound-card/sound-card-availability';
import { SoundSourceChoice } from './sound-source-choice';

/** A phone browser's media devices: a microphone, and no screen sharing. */
function phoneMedia() {
  const track = { stop: vi.fn(), addEventListener: vi.fn() };
  const getUserMedia = vi.fn<(constraints: MediaStreamConstraints) => Promise<MediaStream>>(() =>
    Promise.resolve({
      getAudioTracks: () => [track],
      getTracks: () => [track],
    } as unknown as MediaStream),
  );
  return { getUserMedia, track };
}

/** Records where the microphone's sound is sent, to prove it never reaches the speakers. */
class FakeAudioContext {
  static last: FakeAudioContext | null = null;
  static startState: AudioContextState = 'running';
  state: AudioContextState = FakeAudioContext.startState;
  readonly sampleRate = 48000;
  readonly destination = { name: 'speakers' };
  readonly sentTo: unknown[] = [];
  constructor() {
    FakeAudioContext.last = this;
  }
  createAnalyser() {
    return { fftSize: 0, smoothingTimeConstant: 0, frequencyBinCount: 1024 };
  }
  createMediaStreamSource() {
    return { connect: (node: unknown) => this.sentTo.push(node) };
  }
  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }
  close(): Promise<void> {
    return Promise.resolve();
  }
}

function setup(media: object | null = phoneMedia()) {
  TestBed.configureTestingModule({ providers: [{ provide: MEDIA_DEVICES, useValue: media }] });
  return TestBed.inject(MicrophoneSoundSource);
}

describe('MicrophoneSoundSource', () => {
  beforeEach(() => {
    FakeAudioContext.startState = 'running';
    vi.stubGlobal('AudioContext', FakeAudioContext);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('offers the microphone on a phone, whose browser cannot share a screen', () => {
    expect(setup().options()).toEqual([{ id: 'microphone', label: 'Microphone' }]);
  });

  it('is the source Sync uses on a phone, where nothing else can be heard', () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        { provide: MEDIA_DEVICES, useValue: phoneMedia() },
        { provide: SOUND_CARD_AVAILABLE, useValue: signal(false) },
      ],
    });
    const selected = TestBed.inject(SoundSourceChoice).selected();
    expect(selected?.source).toBe(TestBed.inject(MicrophoneSoundSource));
    expect(selected?.option.label).toBe('Microphone');
  });

  it('is not offered on a desktop, which picks its microphone from Input device', async () => {
    const desktop = { ...phoneMedia(), getDisplayMedia: vi.fn() };
    const microphone = setup(desktop);
    expect(microphone.options()).toEqual([]);
    await expect(microphone.open()).rejects.toBeInstanceOf(CaptureUnsupportedError);
    expect(desktop.getUserMedia).not.toHaveBeenCalled();
  });

  it('is not offered where the browser has no microphone access at all', () => {
    expect(setup(null).options()).toEqual([]);
    TestBed.resetTestingModule();
    expect(setup({}).options()).toEqual([]);
  });

  it('opens the phone’s default input with the browser’s call processing off', async () => {
    const media = phoneMedia();
    await setup(media).open();
    expect(media.getUserMedia).toHaveBeenCalledWith({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  });

  it('sends the sound to the analyser only, never to the speakers', async () => {
    const tap = await setup().open();
    const context = FakeAudioContext.last;
    expect(context?.sentTo.length).toBe(1);
    expect(context?.sentTo).not.toContain(context?.destination);
    expect(tap.sound?.context).toBe(context);
  });

  it('wakes a listening context the phone started suspended', async () => {
    FakeAudioContext.startState = 'suspended';
    await setup().open();
    expect(FakeAudioContext.last?.state).toBe('running');
  });

  it('stops the microphone when Sync lets go of it', async () => {
    const media = phoneMedia();
    const tap = await setup(media).open();
    tap.close();
    expect(media.track.stop).toHaveBeenCalled();
  });

  it('reads a missing or busy microphone as no audio, and passes a refusal on', async () => {
    const missing = phoneMedia();
    missing.getUserMedia.mockRejectedValueOnce(new DOMException('no', 'NotFoundError'));
    await expect(setup(missing).open()).rejects.toBeInstanceOf(NoAudioError);

    TestBed.resetTestingModule();
    const refused = phoneMedia();
    const refusal = new DOMException('no', 'NotAllowedError');
    refused.getUserMedia.mockRejectedValueOnce(refusal);
    await expect(setup(refused).open()).rejects.toBe(refusal);
  });

  it('says the mic hears the room, not through headphones, and keeps nothing', () => {
    const { ask, silent } = setup().guide;
    expect(ask).toContain('hears the room');
    expect(ask).toContain('headphones');
    expect(ask).toContain('Nothing is recorded or sent');
    expect(silent).toContain('No microphone');
  });

  it('waits for Sync rather than asking for the microphone on Play', () => {
    expect(setup().opensWithPlay).toBe(false);
  });
});
