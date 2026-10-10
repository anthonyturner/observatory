import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideAppRouter } from './app.routes';
import { provideJevHold } from './core/agent-speech/provide-jev-hold';
import { ASK_FEED_CHANNEL } from './core/assistant/ask-feed';
import { provideNoticeAnnouncer } from './core/assistant/provide-notice-announcer';
import { DesktopNotices } from './core/notices/desktop-notices';
import { SecurityTabBadge } from './core/security/security-tab-badge';
import { provideVoice } from './core/voice/provide-voice';
import { REVIEW_QUEUE_SHORTCUTS } from './features/starmap/jev-triage/review-queue-shortcuts';
import { TAB_BADGES } from './shared/project-tabs/tab-badge';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAppRouter(),
    provideHttpClient(withFetch()),
    ASK_FEED_CHANNEL,
    REVIEW_QUEUE_SHORTCUTS,
    provideVoice(),
    provideNoticeAnnouncer(),
    provideJevHold(),
    { provide: TAB_BADGES, useFactory: () => [inject(SecurityTabBadge)] },
    // Started with the app rather than with a page, so a hidden tab sends them from any page.
    provideAppInitializer(() => {
      inject(DesktopNotices);
    }),
  ],
};
