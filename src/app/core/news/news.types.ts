/** One headline, as the API's `GET /api/news` gives it. */
export interface NewsItem {
  readonly title: string;
  readonly url: string;
  readonly source: string;
  /** ISO time, or null where the feed gave none. */
  readonly publishedAt: string | null;
  /** A paragraph or two about the story; empty where none could be found. */
  readonly summary: readonly string[];
  /** A new or updated tool, which the AI section lists first. */
  readonly tool: boolean;
}

/** Home's two news sections, newest from the public feeds the server reads. */
export interface NewsReport {
  readonly ai: readonly NewsItem[];
  readonly engineering: readonly NewsItem[];
  /** The sources that could not be read this time, by name. */
  readonly unread: readonly string[];
  readonly readAt: string;
}

/** Where the news stands. Only `ready` carries headlines. */
export type NewsState =
  | { readonly status: 'reading' }
  | { readonly status: 'unreachable' }
  | { readonly status: 'ready'; readonly report: NewsReport };
