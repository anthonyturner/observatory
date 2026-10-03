import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { ASK_FEED_CHANNEL } from './core/assistant/ask-feed';
import { provideNoticeAnnouncer } from './core/assistant/provide-notice-announcer';
import { provideVoice } from './core/voice/provide-voice';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch()),
    ASK_FEED_CHANNEL,
    provideVoice(),
    provideNoticeAnnouncer(),
  ],
};
