import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';
import { isObject, isText, listOf } from '../json/json-fields';

const LIVE_SITES_URL = '/api/live-sites';
/** A site is opened by its address, so only a web address will do. */
const WEB_ADDRESS = /^https?:\/\//i;

type SitesByRepo = ReadonlyMap<string, string>;

/** The production site of each repository in a `GET /api/live-sites` answer, by lower-case `owner/name`. */
export function parseLiveSites(body: unknown): SitesByRepo {
  const sites = isObject(body) ? body['sites'] : null;
  const entries = listOf(sites, (site): [string, string] | null =>
    isObject(site) && isText(site['repo']) && isText(site['url']) && WEB_ADDRESS.test(site['url'])
      ? [site['repo'].toLowerCase(), site['url']]
      : null,
  );
  return new Map(entries);
}

/**
 * Every project's production site, read from the API in one request. Nothing is
 * asked until a screen needs a site (`load`), so a machine that runs every project
 * itself never pays for it, and it is asked once however many cards want it.
 */
@Injectable({ providedIn: 'root' })
export class LiveSites {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sites = signal<SitesByRepo>(new Map());
  private isRequested = false;

  /** Starts the one read, unless it has started. One that failed is tried again by the next screen to ask. */
  load(): void {
    if (this.isRequested) return;
    this.isRequested = true;
    this.http
      .get<unknown>(LIVE_SITES_URL)
      .pipe(
        map(parseLiveSites),
        catchError(() => {
          this.isRequested = false;
          return of(new Map<string, string>());
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((sites) => this.sites.set(sites));
  }

  /** `repo`'s production site, or null where it has none or the sites are not read yet. */
  urlFor(repo: string): string | null {
    return this.sites().get(repo.toLowerCase()) ?? null;
  }
}
