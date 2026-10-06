import { InjectionToken } from '@angular/core';

/** The browser's cameras, microphones and screen sharing; null where it has none. */
export const MEDIA_DEVICES = new InjectionToken<MediaDevices | null>('MEDIA_DEVICES', {
  providedIn: 'root',
  factory: () => globalThis.navigator?.mediaDevices ?? null,
});

/** Whether `media` can share a screen or tab at all; no phone's browser can. */
export function canShareDisplay(media: MediaDevices | null): media is MediaDevices {
  return typeof media?.getDisplayMedia === 'function';
}

/** Whether a share from `media` can carry its sound. Only Chromium's can, and only
 *  Chromium knows the constraint that keeps a captured tab audible, so its support
 *  tells the two apart; Firefox and Safari share pictures alone. */
export function canShareDisplayAudio(media: MediaDevices | null): media is MediaDevices {
  if (!canShareDisplay(media) || typeof media.getSupportedConstraints !== 'function') return false;
  return Reflect.get(media.getSupportedConstraints(), 'suppressLocalAudioPlayback') === true;
}
