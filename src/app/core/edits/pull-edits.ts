import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Observable, Subscription, catchError, map, of, tap } from 'rxjs';
import { LabelLine } from '../queue/pull-detail-parts';
import { editBadgeOf } from './edit-badge';
import { EditClient } from './edit-client';
import { EditChanges, EditRecord } from './edit-record';

/** One pull request's edits, for the screen that provides it: the repository's
 *  labels, an edit on its way, and how the last one went. */
@Injectable()
export class PullEdits {
  private readonly client = inject(EditClient);
  private readonly record = signal<EditRecord | null>(null);
  private readonly sending = signal<EditChanges | null>(null);
  private readonly known = signal<readonly LabelLine[]>([]);
  private target: { repo: string; number: number } | null = null;
  private readonly reads = new Subscription();
  /** The read for the pull request shown now; a newer load cancels it. */
  private current = new Subscription();

  /** The badge under the title, or null. */
  readonly badge = computed(() => editBadgeOf(this.sending(), this.record()));
  readonly hasRecord = computed(() => this.record() !== null);
  readonly labels = this.known.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.reads.unsubscribe();
      this.current.unsubscribe();
    });
  }

  /** Reads this pull request's last edit, and its repository's labels. */
  load(repo: string, number: number): void {
    this.target = { repo, number };
    this.record.set(null);
    this.sending.set(null);
    this.current.unsubscribe();
    this.current = new Subscription();
    this.current.add(
      this.client
        .record(repo, number)
        .pipe(catchError(() => of(null)))
        .subscribe((record) => this.record.set(record)),
    );
    this.current.add(
      this.client
        .labels(repo)
        .pipe(catchError(() => of([])))
        .subscribe((labels) => this.known.set(labels)),
    );
  }

  /** Sends `changes`; answers whether the API took them. How they went is the badge. */
  save(changes: EditChanges): Observable<boolean> {
    const target = this.target;
    if (!target) return of(false);
    this.sending.set(changes);
    return this.client.apply(target.repo, target.number, changes).pipe(
      tap((record) => this.record.set(record)),
      map(() => true),
      catchError(() => of(false)),
      tap(() => this.sending.set(null)),
    );
  }

  /** Clears the badge; if that fails, the badge stays and nothing else is lost. */
  clear(): void {
    const target = this.target;
    if (!target) return;
    this.reads.add(
      this.client
        .clear(target.repo, target.number)
        .pipe(
          map(() => true),
          catchError(() => of(false)),
        )
        .subscribe((cleared) => {
          if (cleared) this.record.set(null);
        }),
    );
  }
}
