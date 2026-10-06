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
