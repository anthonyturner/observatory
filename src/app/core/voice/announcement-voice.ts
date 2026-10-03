import { InjectionToken, Signal, signal } from '@angular/core';

/** Says a line nobody asked for, such as the news, without ever cutting off
 *  a reply. */
export interface AnnouncementVoice {
  /** Reads `text` aloud unless a line is already under way, Speak is off or
   *  the mic is held. Nothing is shown or said when it cannot be heard, and
   *  no download is asked about: nobody asked for this line. */
  announce(text: string): void;
  /** True from the moment any line is taken until it ends, including while
   *  its first piece is still being made and nothing is heard yet. */
  readonly isBusy: Signal<boolean>;
}

/** Until a voice is provided, nothing is announced. */
const SILENT: AnnouncementVoice = {
  announce: () => undefined,
  isBusy: signal(false).asReadonly(),
};

export const ANNOUNCEMENT_VOICE = new InjectionToken<AnnouncementVoice>('AnnouncementVoice', {
  providedIn: 'root',
  factory: () => SILENT,
});
