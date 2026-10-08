/** One software-design idea, as the API's `GET /api/principles` gives it. */
export interface Principle {
  readonly id: string;
  readonly title: string;
  /** What it means, in a sentence or two. */
  readonly idea: string;
  /** Something to ask yourself today. */
  readonly question: string;
}

/** Every principle, and where today's sits among them. */
export interface PrinciplesReport {
  readonly principles: readonly Principle[];
  readonly today: number;
}

/** Where the principles stand, for the card to show. */
export type PrinciplesState =
  | { readonly status: 'reading' }
  | { readonly status: 'ready'; readonly report: PrinciplesReport }
  | { readonly status: 'unreachable' };
