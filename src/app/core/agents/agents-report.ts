import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, map, of } from 'rxjs';

/** One agent's report card, as `GET /api/agents` gives it. */
export interface AgentCard {
  readonly agent: string;
  readonly basis: string;
  readonly prs: readonly number[];
  readonly opened: number;
  readonly merged: number;
  readonly open: number;
  readonly conflicting: number;
  readonly unlinked: number;
  readonly medianMergeHours: number | null;
  readonly medianLines: number | null;
}

export interface AgentsReport {
  readonly since: string | null;
  readonly attributed: number;
  readonly agents: readonly AgentCard[];
}

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const count = (value: unknown): number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
const numberOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

function parseCard(value: unknown): AgentCard | null {
  if (!isObject(value) || typeof value['agent'] !== 'string') return null;
  return {
    agent: value['agent'],
    basis: typeof value['basis'] === 'string' ? value['basis'] : 'unattributed',
    prs: Array.isArray(value['prs'])
      ? value['prs'].filter((n): n is number => Number.isInteger(n))
      : [],
    opened: count(value['opened']),
    merged: count(value['merged']),
    open: count(value['open']),
    conflicting: count(value['conflicting']),
    unlinked: count(value['unlinked']),
    medianMergeHours: numberOrNull(value['medianMergeHours']),
    medianLines: numberOrNull(value['medianLines']),
  };
}

/** The report read defensively: a card that does not parse is left out. */
export function parseAgentsReport(value: unknown): AgentsReport | null {
  if (!isObject(value) || !Array.isArray(value['agents'])) return null;
  return {
    since: typeof value['since'] === 'string' ? value['since'] : null,
    attributed: count(value['attributed']),
    agents: value['agents'].map(parseCard).filter((card): card is AgentCard => card !== null),
  };
}

/** Reads one repository's agent report cards; none until they arrive, or if they cannot be read. */
@Injectable()
export class AgentsFeed {
  private readonly http = inject(HttpClient);
  private readonly current = signal<AgentsReport | null>(null);

  readonly report = this.current.asReadonly();

  load(repo: string): void {
    this.http
      .get<unknown>('/api/agents', { params: { repo } })
      .pipe(
        map((body) => parseAgentsReport(body)),
        catchError(() => of(null)),
      )
      .subscribe((report) => this.current.set(report));
  }
}
