import { AudioTap, NoAudioError, tapOf } from './audio-tap';

/** What getUserMedia throws when the input is missing or another app holds it. */
const NO_INPUT_ERRORS: ReadonlySet<string> = new Set([
  'NotFoundError',
  'OverconstrainedError',
  'NotReadableError',
]);

/** Opens the audio input `audio` describes. Its sound goes to the analyser only,
 *  never to the speakers, so a microphone cannot feed back. */
export async function captureInputAudio(
  media: MediaDevices,
  audio: MediaTrackConstraints,
): Promise<AudioTap> {
  const stream = await media.getUserMedia({ audio }).catch(rethrowMissing);
  const [track] = stream.getAudioTracks();
  if (!track) throw new NoAudioError();
  return tapOf(stream, track);
}

/** A missing or busy input is the listener's to fix, not a fault: it reads as no audio. */
function rethrowMissing(error: unknown): never {
  if (error instanceof DOMException && NO_INPUT_ERRORS.has(error.name)) throw new NoAudioError();
  throw error;
}
