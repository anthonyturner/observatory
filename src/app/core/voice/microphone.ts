import { DOCUMENT, InjectionToken, inject } from '@angular/core';
import { MIC_LEVEL, nextLevel } from './level-math';
import { LIMIT_MS, within } from './within';

/** A recording under way. */
export interface MicRecording {
  /** How loud the microphone is now, 0 to 1, smoothed; read once a frame. */
  level(): number;
  /** Stops, and hands over what it caught. */
  finish(): Promise<Blob>;
  discard(): void;
}

/** A microphone the browser has let the page open. */
export interface MicStream {
  /** Starts recording. `onCut` runs when the recording ends by itself. */
  record(onCut: () => void): MicRecording;
  close(): void;
}

export interface Microphone {
  canRecord(): boolean;
  /** Recording needs a secure address: https, or localhost. */
  isSecure(): boolean;
  /** Rejects with getUserMedia's own error when the browser refuses. */
  open(): Promise<MicStream>;
}

export const MICROPHONE = new InjectionToken<Microphone>('Microphone', {
  providedIn: 'root',
  factory: () => new BrowserMicrophone(inject(DOCUMENT).defaultView),
});

const CONSTRAINTS: MediaStreamConstraints = {
  audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
};
const METER_FFT_SIZE = 1024;

class BrowserMicrophone implements Microphone {
  constructor(private readonly window: (Window & typeof globalThis) | null) {}

  canRecord(): boolean {
    return (
      !!this.window?.navigator.mediaDevices?.getUserMedia && 'MediaRecorder' in (this.window ?? {})
    );
  }

  isSecure(): boolean {
    return this.window?.isSecureContext ?? false;
  }

  async open(): Promise<MicStream> {
    const devices = this.window?.navigator.mediaDevices;
    if (!devices) throw new DOMException('No media devices here', 'NotFoundError');
    return new BrowserMicStream(await devices.getUserMedia(CONSTRAINTS));
  }
}

class BrowserMicStream implements MicStream {
  constructor(private readonly stream: MediaStream) {}

  record(onCut: () => void): MicRecording {
    return new BrowserMicRecording(this.stream, onCut);
  }

  close(): void {
    this.stream.getTracks().forEach((track) => track.stop());
  }
}

class BrowserMicRecording implements MicRecording {
  private readonly chunks: Blob[] = [];
  private readonly recorder: MediaRecorder;
  private readonly stopped: Promise<void>;
  private readonly meter: LevelMeter | null;
  private smoothed = 0;

  constructor(
    private readonly stream: MediaStream,
    onCut: () => void,
  ) {
    this.recorder = new MediaRecorder(stream);
    this.recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size) this.chunks.push(event.data);
    });
    this.stopped = new Promise((resolve) =>
      this.recorder.addEventListener('stop', () => resolve(), { once: true }),
    );
    // The mic unplugged, or blocked from the address bar, ends its track, and
    // the recorder stops or fails: the end of the recording, like letting go.
    this.recorder.addEventListener('stop', onCut);
    this.recorder.addEventListener('error', onCut);
    stream.getTracks().forEach((track) => track.addEventListener('ended', onCut));
    this.recorder.start();
    this.meter = openMeter(stream);
  }

  level(): number {
    if (!this.meter) return 0;
    this.meter.analyser.getFloatTimeDomainData(this.meter.samples);
    this.smoothed = nextLevel(this.smoothed, this.meter.samples, MIC_LEVEL);
    return this.smoothed;
  }

  async finish(): Promise<Blob> {
    this.end();
    // One that never says it stopped still gives what it has.
    await within(this.stopped, LIMIT_MS.stop, 'stop').catch(() => undefined);
    return new Blob(this.chunks, { type: this.recorder.mimeType });
  }

  discard(): void {
    this.end();
  }

  private end(): void {
    this.stream.getTracks().forEach((track) => track.stop());
    this.meter?.context.close().catch(() => undefined);
    if (this.recorder.state !== 'inactive') this.recorder.stop();
  }
}

interface LevelMeter {
  readonly context: AudioContext;
  readonly analyser: AnalyserNode;
  readonly samples: Float32Array<ArrayBuffer>;
}

/** The meter is a nicety; the recording goes on without it. */
function openMeter(stream: MediaStream): LevelMeter | null {
  try {
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = METER_FFT_SIZE;
    context.createMediaStreamSource(stream).connect(analyser);
    return { context, analyser, samples: new Float32Array(analyser.fftSize) };
  } catch {
    return null;
  }
}
