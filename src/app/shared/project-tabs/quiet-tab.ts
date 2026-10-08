import { Observable } from 'rxjs';

/** A screen many projects have nothing on, such as Milestones, whose tab recedes for those. */
export interface QuietTab {
  /** The `id` of the tab it speaks for. */
  readonly tabId: string;
  /** Whether `owner/name` has nothing on the screen; false, or nothing yet, leaves the tab as it is. */
  isEmpty(repo: string): Observable<boolean>;
}
