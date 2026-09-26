import { Injectable, computed, inject, signal } from '@angular/core';
import { ASSISTANT_API, AssistantRefused } from './assistant-api';
import { AssistantStatus, JevState, SiteWhere, Skill } from './assistant.types';

/** The skills as far as Home knows them. Only a known empty list is "none";
 *  a router that never answered leaves them unknown. */
export type SkillsState =
  | { readonly status: 'loading' }
  | { readonly status: 'lost' }
  | { readonly status: 'known'; readonly skills: readonly Skill[] };

/** What the router says about itself: whether Jev is on, where the site runs,
 *  and the skills. Asked once as Home opens, and again on Try again. */
@Injectable({ providedIn: 'root' })
export class AssistantInfo {
  private readonly api = inject(ASSISTANT_API);
  private readonly answer = signal<AssistantStatus | null>(null);
  private readonly unanswered = signal(false);
  /** Every reply says whether Jev is on, so a stale answer mends itself. */
  private readonly jevSince = signal<JevState | null>(null);
  private readonly refused = signal(false);

  /** The router refused this viewer: a visitor to the hosted preview, for
   *  whom there is no assistant rather than a broken one. */
  readonly isRefused = this.refused.asReadonly();

  readonly jev = computed(() => this.jevSince() ?? this.answer()?.jev ?? null);
  readonly where = computed<SiteWhere | null>(() => this.answer()?.where ?? null);
  readonly skills = computed<SkillsState>(() => {
    const answer = this.answer();
    if (answer) return { status: 'known', skills: answer.skills };
    return this.unanswered() ? { status: 'lost' } : { status: 'loading' };
  });

  constructor() {
    void this.load();
  }

  /** Asks the router again; `skills` says how that went. */
  async load(): Promise<void> {
    try {
      this.answer.set(await this.api.status());
      this.jevSince.set(null);
      this.unanswered.set(false);
    } catch (error: unknown) {
      if (error instanceof AssistantRefused) this.refused.set(true);
      // Unknown, not none: the skills panel says so and offers Try again.
      else this.unanswered.set(true);
    }
  }

  noteRefused(): void {
    this.refused.set(true);
  }

  noteJev(state: JevState): void {
    this.jevSince.set(state);
  }
}
