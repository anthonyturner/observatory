import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { CiHealth, parseCiHealth } from './actions-report';

const CI_HEALTH_URL = '/api/ci-health';

/**
 * Each project's default-branch CI, for the marks on Home's project cards.
 * A card asks when it appears; the API keeps the answer for a few minutes,
 * so asking again on every visit to Home costs GitHub nothing.
 */
@Injectable({ providedIn: 'root' })
export class CiHealthFeed {
  private readonly http = inject(HttpClient);
  private readonly byRepo = signal<ReadonlyMap<string, CiHealth>>(new Map());
  private readonly inFlight = new Set<string>();

  /** The health read so far, by `owner/name`. */
  readonly health = this.byRepo.asReadonly();

  /** Reads `repo`'s health unless a read of it is already on its way. A failed read shows no mark. */
  request(repo: string): void {
    if (this.inFlight.has(repo)) return;
    this.inFlight.add(repo);
    this.http.get<unknown>(CI_HEALTH_URL, { params: { repo } }).subscribe({
      next: (body) => {
        this.inFlight.delete(repo);
        const health = parseCiHealth(body);
        if (health) this.byRepo.update((known) => new Map(known).set(repo, health));
      },
      error: () => this.inFlight.delete(repo),
    });
  }
}
