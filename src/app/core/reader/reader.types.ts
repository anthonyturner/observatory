/** One piece of a page's readable text. */
export interface ReadableBlock {
  readonly kind: 'heading' | 'paragraph' | 'item';
  readonly text: string;
}

/** A page as the reader shows it: plain text from the page, never its code. */
export interface ReadablePage {
  readonly url: string;
  readonly title: string;
  readonly site: string;
  readonly published: string | null;
  readonly image: string | null;
  readonly blocks: readonly ReadableBlock[];
  /** Whether the site lets itself be shown in a frame here. */
  readonly canEmbed: boolean;
  /** Too little text to be the article: a paywall, a sign-in, or a page built by script. */
  readonly isThin: boolean;
}

/** What the reader window shows. */
export type ReaderState =
  | { readonly status: 'closed' }
  | { readonly status: 'loading'; readonly url: string }
  | { readonly status: 'ready'; readonly url: string; readonly page: ReadablePage }
  | { readonly status: 'failed'; readonly url: string; readonly failed: string };
