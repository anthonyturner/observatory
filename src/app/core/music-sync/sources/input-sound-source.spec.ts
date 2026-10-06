import { TestBed } from '@angular/core/testing';
import { NoAudioError } from './audio-tap';
import { InputSoundSource } from './input-sound-source';
import { MEDIA_DEVICES } from './media-devices';

type Device = Pick<MediaDeviceInfo, 'kind' | 'deviceId' | 'label'>;

const MIX: Device = { kind: 'audioinput', deviceId: 'mix-1', label: 'Stereo Mix (Realtek)' };
const MIC: Device = { kind: 'audioinput', deviceId: 'mic-1', label: 'Microphone (USB)' };
const HIDDEN: Device = { kind: 'audioinput', deviceId: '', label: '' };

/** A desktop browser's media devices, its inputs named or hidden as the test says. */
class FakeMedia {
  devices: readonly Device[] = [HIDDEN];
  private readonly changes: (() => void)[] = [];
  readonly track = { stop: vi.fn(), addEventListener: vi.fn() };
  readonly getUserMedia = vi.fn<(constraints: MediaStreamConstraints) => Promise<MediaStream>>(() =>
    Promise.resolve({
      getAudioTracks: () => [this.track],
      getTracks: () => [this.track],
    } as unknown as MediaStream),
  );
  readonly getDisplayMedia = vi.fn();
  enumerateDevices = (): Promise<readonly Device[]> => Promise.resolve(this.devices);
  addEventListener(type: string, listener: () => void): void {
    if (type === 'devicechange') this.changes.push(listener);
  }
  removeEventListener(): void {
    this.changes.length = 0;
  }
  plugIn(...devices: Device[]): void {
    this.devices = devices;
    this.changes.forEach((listener) => listener());
  }
}

/** Records where the input's sound is sent, to prove it never reaches the speakers. */
class FakeAudioContext {
  static last: FakeAudioContext | null = null;
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
  close(): Promise<void> {
    return Promise.resolve();
  }
}

const settle = (): Promise<void> => new Promise((done) => setTimeout(done));

function setup(media: object | null = new FakeMedia()) {
  TestBed.configureTestingModule({ providers: [{ provide: MEDIA_DEVICES, useValue: media }] });
  return TestBed.inject(InputSoundSource);
}

describe('InputSoundSource', () => {
  beforeEach(() => vi.stubGlobal('AudioContext', FakeAudioContext));
  afterEach(() => vi.unstubAllGlobals());

  it('offers one entry that asks while the browser hides the inputs’ names', async () => {
    const input = setup();
    await settle();
    expect(input.options()).toEqual([{ id: 'input', label: 'Choose input…' }]);
  });

  it('lists the inputs by name once they show, leaving out the browser’s aliases', async () => {
    const media = new FakeMedia();
    media.devices = [
      { kind: 'audioinput', deviceId: 'default', label: 'Default - Microphone (USB)' },
      MIC,
      MIX,
      { kind: 'audiooutput', deviceId: 'speakers', label: 'Speakers' },
    ];
    const input = setup(media);
    await settle();
    expect(input.options()).toEqual([
      { id: 'input', label: 'Default input' },
      { id: 'input:mic-1', label: 'Microphone (USB)' },
      { id: 'input:mix-1', label: 'Stereo Mix (Realtek)' },
    ]);
  });

  it('follows inputs plugged in or out', async () => {
    const media = new FakeMedia();
    const input = setup(media);
    await settle();
    media.plugIn(MIX);
    await settle();
    expect(input.options().map(({ id }) => id)).toEqual(['input', 'input:mix-1']);
  });

  it('opens the picked input with the browser’s call processing off', async () => {
    const media = new FakeMedia();
    await setup(media).open('input:mix-1');
    expect(media.getUserMedia).toHaveBeenCalledWith({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        deviceId: { exact: 'mix-1' },
      },
    });
  });

  it('lets the browser pick the input for its own entry, then lists the names', async () => {
    const media = new FakeMedia();
    const input = setup(media);
    await settle();
    media.devices = [MIX];
    await input.open('input');
    await settle();
    expect(media.getUserMedia.mock.calls[0][0].audio).not.toHaveProperty('deviceId');
    expect(input.options().map(({ id }) => id)).toEqual(['input', 'input:mix-1']);
  });

  it('sends the sound to the analyser only, never to the speakers', async () => {
    const tap = await setup().open('input');
    const context = FakeAudioContext.last;
    expect(context?.sentTo.length).toBe(1);
    expect(context?.sentTo).not.toContain(context?.destination);
    expect(tap.sound?.context).toBe(context);
  });

  it('reads a missing or busy input as no audio', async () => {
    for (const name of ['NotFoundError', 'OverconstrainedError', 'NotReadableError']) {
      const media = new FakeMedia();
      media.getUserMedia.mockRejectedValueOnce(new DOMException('no', name));
      TestBed.resetTestingModule();
      await expect(setup(media).open('input:gone')).rejects.toBeInstanceOf(NoAudioError);
    }
  });

  it('passes a refusal on as the browser gave it', async () => {
    const media = new FakeMedia();
    const refusal = new DOMException('no', 'NotAllowedError');
    media.getUserMedia.mockRejectedValueOnce(refusal);
    await expect(setup(media).open('input')).rejects.toBe(refusal);
  });

  it('is not offered on a phone, whose browser cannot share a screen', async () => {
    const phone = new FakeMedia();
    Object.assign(phone, { getDisplayMedia: undefined });
    const input = setup(phone);
    await settle();
    expect(input.options()).toEqual([]);
  });
});
