import type { RunTicket } from '../assistant/route-contract.ts';
import { randomBytes } from 'node:crypto';
import { Forbidden } from '../http/api-handler.ts';
import type { Checkout } from './checkouts.ts';

/** A run the owner may start: what a proposal's Run button carries. */
export type ProposalToken = RunTicket;

/** What starting a run must repeat of its proposal, word for word. */
export interface StartRequest {
  readonly token: string;
  readonly prompt: string;
  readonly folder: string;
}

/** The proposal a token stands for. */
export interface Proposal {
  readonly prompt: string;
  readonly folder: string;
  readonly name: string;
  readonly expiresAt: number;
}

/** What a proposal book needs to know; the runner gives it from RunLimits. */
export interface ProposalTerms {
  readonly proposalMs: number;
  readonly runMs: number;
  readonly offers: number;
  readonly command: string;
}

const TOKEN_BYTES = 24;

/** Every refusal reads the same on purpose: the page's answer to each is to propose again. */
export const NO_LONGER_VALID = 'the proposal was no longer valid';

/**
 * The tokens handed out with proposals: random, single use, valid for
 * `proposalMs`, and bound to the exact prompt and folder the proposal showed,
 * so a request that skips the page's Run button still needs one and cannot
 * change either on the way.
 */
export class ProposalBook {
  private readonly waiting = new Map<string, Proposal>();

  private readonly terms: ProposalTerms;
  private readonly clock: () => number;

  constructor(terms: ProposalTerms, clock: () => number) {
    this.terms = terms;
    this.clock = clock;
  }

  /** A new token for `prompt` in `checkout`. The oldest waiting token goes when
   *  `offers` are already waiting. */
  issue(prompt: string, checkout: Checkout): ProposalToken {
    this.tidy();
    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    const expiresAt = this.clock() + this.terms.proposalMs;
    this.waiting.set(token, { prompt, folder: checkout.folder, name: checkout.name, expiresAt });
    return {
      token,
      folder: checkout.folder,
      name: checkout.name,
      expiresAt,
      limitMs: this.terms.runMs,
      command: this.terms.command,
    };
  }

  /**
   * The proposal `request` repeats, still waiting to be used; a Forbidden
   * otherwise. An expired or mismatched token is spent by the attempt, so it
   * cannot be tried again with other words.
   */
  vet(request: StartRequest): Proposal {
    const proposal = this.waiting.get(request.token);
    if (!proposal) throw new Forbidden(NO_LONGER_VALID);
    const isExpired = proposal.expiresAt <= this.clock();
    const isMismatch = proposal.prompt !== request.prompt || proposal.folder !== request.folder;
    if (isExpired || isMismatch) {
      this.spend(request.token);
      throw new Forbidden(NO_LONGER_VALID);
    }
    return proposal;
  }

  /** `token` can never be used again. */
  spend(token: string): void {
    this.waiting.delete(token);
  }

  private tidy(): void {
    const now = this.clock();
    for (const [token, proposal] of this.waiting) {
      if (proposal.expiresAt <= now) this.waiting.delete(token);
    }
    while (this.waiting.size >= this.terms.offers) {
      const oldest = this.waiting.keys().next().value;
      if (oldest === undefined) return;
      this.waiting.delete(oldest);
    }
  }
}
