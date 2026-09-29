/** Which of Home's two news sections a feed belongs to. */
export type NewsTopic = 'ai' | 'engineering';

/** One public feed the news is read from. */
export interface NewsSource {
  readonly name: string;
  readonly url: string;
  readonly topic: NewsTopic;
  /** Only headlines matching this are kept, for a feed that covers more than its topic. */
  readonly only?: RegExp;
}

/** One headline as a feed gives it. */
export interface FeedItem {
  readonly title: string;
  readonly url: string;
  /** ISO time, or null where the feed gives none that parses. */
  readonly publishedAt: string | null;
  /** A paragraph or two about the story; empty where none could be found. */
  readonly summary: readonly string[];
  /** A thumbnail for the story, https only; null where none was found. */
  readonly image: string | null;
}

/** One headline as Home shows it. */
export interface NewsItem extends FeedItem {
  readonly source: string;
  /** A new or updated tool, which the AI section lists first. */
  readonly tool: boolean;
}

/** What `GET /api/news` returns. */
export interface NewsReport {
  readonly ai: readonly NewsItem[];
  readonly engineering: readonly NewsItem[];
  /** The sources that could not be read this time, by name. */
  readonly unread: readonly string[];
  readonly readAt: string;
}
