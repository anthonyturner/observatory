import {
  DestroyRef,
  ErrorHandler,
  Injectable,
  Signal,
  computed,
  inject,
  signal,
} from '@angular/core';
import { AudioTap, CaptureUnsupportedError } from './audio-tap';
import { UNPROCESSED_AUDIO } from './display-audio';
import { captureInputAudio } from './input-audio';
import { MEDIA_DEVICES, canShareDisplay } from './media-devices';
import { detailOf, optionIdOf } from './option-id';
import { SoundGuide, SoundOption, SoundSource } from './sound-source.types';

const SOURCE_ID = 'input';
/** The browser's own picks, already listed as the device each stands for. */
const ALIAS_IDS: ReadonlySet<string> = new Set(['default', 'communications']);
/** Before access is granted the browser hides the inputs' names, so one entry asks. */
const ASK: SoundOption = { id: SOURCE_ID, label: 'Choose input…' };
/** Once the names show, the same entry opens whichever input the system uses. */
const SYSTEM_DEFAULT: SoundOption = { id: SOURCE_ID, label: 'Default input' };

/** A named audio input on offer. */
interface NamedInput {
  readonly deviceId: string;
  readonly label: string;
}

/** An audio input, such as a loopback device that carries the computer's own sound
 *  (Stereo Mix, VB-Audio Virtual Cable, BlackHole), or a microphone, which hears the
 *  room. Offered on desktops only, told apart by sharing a screen, which no phone's
 *  browser can; a phone has its Microphone source instead. */
@Injectable({ providedIn: 'root' })
export class InputSoundSource implements SoundSource {
  private readonly media = inject(MEDIA_DEVICES);
  private readonly errors = inject(ErrorHandler);
  private readonly inputs = signal<readonly NamedInput[]>([]);
  private readonly isUsable =
    canShareDisplay(this.media) && typeof this.media.getUserMedia === 'function';

  readonly id = SOURCE_ID;
  readonly name = 'Input device';
  readonly guide: SoundGuide = {
    ask: 'The browser asks to use an audio input: allow it. For the computer’s own sound pick a loopback input, such as Stereo Mix (Windows: Sound settings › More sound settings › Recording, show disabled devices, enable it), VB-Audio Virtual Cable or BlackHole on a Mac; a microphone hears the room. Nothing is recorded or sent.',
    silent: 'That input is missing or in use by another app',
  };
  readonly opensWithPlay = true;
  readonly options: Signal<readonly SoundOption[]> = computed(() => {
    if (!this.isUsable) return [];
    const named = this.inputs();
    if (named.length === 0) return [ASK];
    return [SYSTEM_DEFAULT, ...named.map(optionOf)];
  });

  constructor() {
    if (!this.isUsable) return;
    const refresh = (): void => this.refresh();
    this.media?.addEventListener('devicechange', refresh);
    inject(DestroyRef).onDestroy(() => this.media?.removeEventListener('devicechange', refresh));
    this.refresh();
  }

  /** Opens the input `optionId` names, or the system's own for the bare id, with
   *  the browser's call processing off. */
  async open(optionId: string): Promise<AudioTap> {
    const media = this.media;
    if (!this.isUsable || !media) throw new CaptureUnsupportedError();
    const deviceId = detailOf(optionId);
    const audio: MediaTrackConstraints = deviceId
      ? { ...UNPROCESSED_AUDIO, deviceId: { exact: deviceId } }
      : UNPROCESSED_AUDIO;
    const tap = await captureInputAudio(media, audio);
    this.refresh();
    return tap;
  }

  /** The names show once access is granted, and devices come and go. */
  private refresh(): void {
    this.media
      ?.enumerateDevices()
      .then((devices) => this.inputs.set(namedInputsOf(devices)))
      .catch((error: unknown) => this.errors.handleError(error));
  }
}

function namedInputsOf(devices: readonly MediaDeviceInfo[]): NamedInput[] {
  return devices
    .filter(({ kind, deviceId, label }) => kind === 'audioinput' && deviceId && label)
    .filter(({ deviceId }) => !ALIAS_IDS.has(deviceId))
    .map(({ deviceId, label }) => ({ deviceId, label }));
}

function optionOf({ deviceId, label }: NamedInput): SoundOption {
  return { id: optionIdOf(SOURCE_ID, deviceId), label };
}
