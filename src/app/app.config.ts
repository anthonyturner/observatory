import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { ASK_FEED_CHANNEL } from './core/assistant/ask-feed';
import { DesktopNotices } from './core/notices/desktop-notices';
import { provideVoice } from './core/voice/provide-voice';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch()),
    ASK_FEED_CHANNEL,
    provideVoice(),
    // Started with the app rather than with a page, so a hidden tab sends them from any page.
    provideAppInitializer(() => {
      inject(DesktopNotices);
    }),
  ],
};
