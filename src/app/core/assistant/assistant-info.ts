import { Injectable, computed, inject, signal } from '@angular/core';
import { ViewerSession } from '../session/viewer-session';
import { ASSISTANT_API, AssistantAbsent } from './assistant-api';
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
  private readonly session = inject(ViewerSession);
  private readonly absent = signal(false);

  /** No assistant here: it answers only on the owner's own machine. The
   *  session says so for the hosted site; the API's answer says so too. */
  readonly isElsewhere = computed(() => this.absent() || this.session.access() !== 'local');

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
      if (error instanceof AssistantAbsent) this.absent.set(true);
      // Unknown, not none: the skills panel says so and offers Try again.
      else this.unanswered.set(true);
    }
  }

  noteAbsent(): void {
    this.absent.set(true);
  }

  noteJev(state: JevState): void {
    this.jevSince.set(state);
  }
}
