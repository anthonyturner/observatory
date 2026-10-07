import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideJevHold } from './core/agent-speech/provide-jev-hold';
import { ASK_FEED_CHANNEL } from './core/assistant/ask-feed';
import { provideNoticeAnnouncer } from './core/assistant/provide-notice-announcer';
import { DesktopNotices } from './core/notices/desktop-notices';
import { provideVoice } from './core/voice/provide-voice';
import { REVIEW_QUEUE_SHORTCUTS } from './features/starmap/jev-triage/review-queue-shortcuts';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch()),
    ASK_FEED_CHANNEL,
    REVIEW_QUEUE_SHORTCUTS,
    provideVoice(),
    provideNoticeAnnouncer(),
    provideJevHold(),
    // Started with the app rather than with a page, so a hidden tab sends them from any page.
    provideAppInitializer(() => {
      inject(DesktopNotices);
    }),
  ],
};
