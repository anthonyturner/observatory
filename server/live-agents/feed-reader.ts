import { SESSION_LOGS_DIR } from '../usage/usage-paths.ts';
import { firstPage, pageFrom } from './feed-page.ts';
import type { AgentFeedSource } from './feed-routes.ts';
import type { AgentFeedPage } from './feed-types.ts';
import { transcriptOf } from './transcript-files.ts';

const NO_TRANSCRIPT: AgentFeedPage = { events: [], next: null, isRestart: true };

/** One agent's feed, read from its transcript under `logsDir` as of each request. */
export function agentFeedReader(logsDir = SESSION_LOGS_DIR): AgentFeedSource {
  return {
    feed: async (key, from) => {
      const transcript = await transcriptOf(logsDir, key);
      if (!transcript) return NO_TRANSCRIPT;
      return from === null ? firstPage(transcript.file) : pageFrom(transcript.file, from);
    },
  };
}
