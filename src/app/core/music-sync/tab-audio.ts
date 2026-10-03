import { InjectionToken } from '@angular/core';

/** The tab's own sound, ready to read as a spectrum. */
export interface AudioTap {
  /** Hertz per bin of `read`. */
  readonly binHz: number;
  readonly binCount: number;
  /** Fills `into` with the spectrum now, one byte per bin. */
  read(into: Uint8Array<ArrayBuffer>): void;
  /** Called once if sharing stops from outside, as from Chrome's "Stop sharing". */
  onEnded(callback: () => void): void;
  close(): void;
}

/** Sharing went ahead without the "Share tab audio" box ticked. */
export class NoTabAudioError extends Error {
  constructor() {
    super('The tab was shared without its audio');
  }
}

/** This browser cannot share a tab's audio with the page. */
export class TabAudioUnsupportedError extends Error {
  constructor() {
    super('This browser cannot capture a tab’s audio');
  }
}

/** Asks to hear this tab; must run inside a click or key press. */
export type AudioTapOpener = () => Promise<AudioTap>;

export const AUDIO_TAP = new InjectionToken<AudioTapOpener>('AUDIO_TAP', {
  providedIn: 'root',
  factory: () => openTabAudio,
});

/** Fine enough to split a kick from a bassline; 1024 bins at 48 kHz is ~23 Hz a bin. */
const FFT_SIZE = 2048;
/** Barely any smoothing: more blurs a kick's attack across frames and lands it late. */
const SMOOTHING = 0.2;

/** Chrome's options for capturing this tab, beyond the standard's typings. */
interface TabCaptureOptions extends DisplayMediaStreamOptions {
  readonly preferCurrentTab: boolean;
  readonly selfBrowserSurface: 'include';
}

/** Chrome's share prompt, offering this tab first. Only the audio is kept:
 *  the video track is stopped at once, and nothing is played back or sent. */
async function openTabAudio(): Promise<AudioTap> {
  const media = globalThis.navigator?.mediaDevices;
  if (typeof media?.getDisplayMedia !== 'function') throw new TabAudioUnsupportedError();
  const options: TabCaptureOptions = {
    video: true,
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    preferCurrentTab: true,
    selfBrowserSurface: 'include',
  };
  const stream = await media.getDisplayMedia(options);
  stream.getVideoTracks().forEach((track) => track.stop());
  const [audio] = stream.getAudioTracks();
  if (!audio) throw new NoTabAudioError();
  return tapOf(stream, audio);
}

function tapOf(stream: MediaStream, audio: MediaStreamTrack): AudioTap {
  const context = new AudioContext();
  const analyser = context.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.smoothingTimeConstant = SMOOTHING;
  // Into the analyser only, never to the speakers: the tab is already playing it.
  context.createMediaStreamSource(stream).connect(analyser);
  const close = (): void => {
    stream.getTracks().forEach((track) => track.stop());
    void context.close();
  };
  return {
    binHz: context.sampleRate / FFT_SIZE,
    binCount: analyser.frequencyBinCount,
    read: (into) => analyser.getByteFrequencyData(into),
    onEnded: (callback) => audio.addEventListener('ended', callback, { once: true }),
    close,
  };
}
