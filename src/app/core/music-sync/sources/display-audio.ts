import { AudioTap, CaptureUnsupportedError, NoAudioError, tapOf } from './audio-tap';
import { canShareDisplay } from './media-devices';

/** The sound as it is: the browser's call-tidying would cancel the very music measured. */
export const UNPROCESSED_AUDIO: Readonly<MediaTrackConstraints> = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
};

/** Opens the browser's share prompt and keeps only the audio: the video track is
 *  stopped at once, and nothing is played back or sent. */
export async function captureDisplayAudio(
  media: MediaDevices | null,
  options: DisplayMediaStreamOptions,
): Promise<AudioTap> {
  if (!canShareDisplay(media)) throw new CaptureUnsupportedError();
  const stream = await media.getDisplayMedia(options);
  stream.getVideoTracks().forEach((track) => track.stop());
  const [audio] = stream.getAudioTracks();
  if (!audio) throw new NoAudioError();
  return tapOf(stream, audio);
}
