/* pr-starmap's agent report cards: how each agent's pull requests fare once
   handed back. Attribution comes in three grades, and every card says which
   it rests on: NAMED when the pull-request event carried the agent, INFERRED
   when an agent in the same session finished within fifteen minutes after it
   opened, and otherwise credited to the MAIN SESSION, never guessed. */

/** One line the capture hook recorded. */
export interface Handoff {
  readonly at: string;
  readonly kind: 'pr-opened' | 'agent-stop' | 'session-stop';
  readonly session: string | null;
  readonly cwd?: string;
  readonly agent: string | null;
  readonly pr?: number;
  readonly url?: string;
}

/** A pull request as the cards count it, as `gh pr list --state all --json` gives it. */
export interface AgentPull {
  readonly number: number;
  readonly state: string;
  readonly mergeable: string;
  readonly createdAt: string;
  readonly mergedAt: string | null;
  readonly closedAt: string | null;
  readonly additions: number | null;
  readonly deletions: number | null;
  readonly closingIssuesReferences: readonly { readonly number: number }[] | null;
}

/** The `gh --json` fields an AgentPull holds. */
export const AGENT_PULL_FIELDS: readonly string[] = [
  'number',
  'state',
  'mergeable',
  'createdAt',
  'mergedAt',
  'closedAt',
  'additions',
  'deletions',
  'closingIssuesReferences',
];

/** What the cards need from GitHub. */
export interface AgentReader {
  /** Every pull request of the repository, open or not, as many as a card could need. */
  agentPulls(repo: string): Promise<AgentPull[]>;
}

export type Basis = 'named' | 'inferred' | 'unattributed';

export interface AgentCard {
  readonly agent: string;
  readonly basis: 'named' | 'named and inferred' | 'inferred' | 'unattributed';
  readonly prs: readonly number[];
  readonly opened: number;
  readonly merged: number;
  readonly closed: number;
  readonly open: number;
  readonly conflicting: number;
  readonly unlinked: number;
  readonly medianMergeHours: number | null;
  readonly medianLines: number | null;
}

/** What `GET /api/agents` returns. */
export interface AgentsReport {
  readonly generatedAt: string;
  readonly repo: string;
  /** When the record began: a card built on three pull requests is a hint, not a verdict. */
  readonly since: string | null;
  readonly attributed: number;
  readonly agents: readonly AgentCard[];
}

const INFER_WINDOW_MS = 15 * 60 * 1000;
export const MAIN_SESSION = 'main session';
const HOUR_MS = 3_600_000;

/** Pull request number → who opened it and how we know, from the handoffs alone. */
export function attribute(
  handoffs: readonly Handoff[],
  repo: string,
): Map<number, { agent: string; how: Basis }> {
  const same = (url: string | undefined): boolean =>
    !url || url.toLowerCase().includes(`github.com/${repo.toLowerCase()}/pull/`);
  const stops = handoffs.filter((h) => h.kind === 'agent-stop' && h.agent);
  const out = new Map<number, { agent: string; how: Basis }>();
  for (const h of handoffs) {
    if (h.kind !== 'pr-opened' || !h.pr || !same(h.url)) continue;
    if (h.agent) {
      out.set(h.pr, { agent: h.agent, how: 'named' });
      continue;
    }
    const at = Date.parse(h.at);
    const next = stops
      .filter(
        (s) =>
          s.session === h.session &&
          Date.parse(s.at) >= at &&
          Date.parse(s.at) - at <= INFER_WINDOW_MS,
      )
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0];
    if (!out.has(h.pr) || out.get(h.pr)?.how !== 'named') {
      out.set(
        h.pr,
        next?.agent
          ? { agent: next.agent, how: 'inferred' }
          : { agent: MAIN_SESSION, how: 'unattributed' },
      );
    }
  }
  return out;
}

const median = (xs: readonly number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** One card per agent, from its pull requests' current state. */
export function reportCards(
  handoffs: readonly Handoff[],
  pulls: readonly AgentPull[],
  repo: string,
  now = Date.now(),
): AgentsReport {
  const since = handoffs.reduce<string | null>((m, h) => (!m || h.at < m ? h.at : m), null);
  const who = attribute(handoffs, repo);
  const generatedAt = new Date(now).toISOString();
  if (!who.size) return { generatedAt, repo, since, attributed: 0, agents: [] };

  const byNumber = new Map(pulls.map((p) => [p.number, p]));
  const cards = new Map<string, { prs: number[]; how: Set<Basis>; rows: AgentPull[] }>();
  for (const [n, { agent, how }] of who) {
    const pr = byNumber.get(n);
    if (!pr) continue;
    const card = cards.get(agent) ?? { prs: [], how: new Set<Basis>(), rows: [] };
    card.prs.push(n);
    card.how.add(how);
    card.rows.push(pr);
    cards.set(agent, card);
  }

  const agents: AgentCard[] = [...cards].map(([agent, c]) => {
    const merged = c.rows.filter((p) => p.state === 'MERGED');
    const open = c.rows.filter((p) => p.state === 'OPEN');
    return {
      agent,
      basis: c.how.has('named')
        ? c.how.size > 1
          ? 'named and inferred'
          : 'named'
        : c.how.has('inferred')
          ? 'inferred'
          : 'unattributed',
      prs: [...c.prs].sort((a, b) => a - b),
      opened: c.rows.length,
      merged: merged.length,
      closed: c.rows.filter((p) => p.state === 'CLOSED').length,
      open: open.length,
      conflicting: open.filter((p) => p.mergeable === 'CONFLICTING').length,
      unlinked: c.rows.filter((p) => !(p.closingIssuesReferences ?? []).length).length,
      medianMergeHours: median(
        merged.map(
          (p) => (Date.parse(p.mergedAt ?? p.createdAt) - Date.parse(p.createdAt)) / HOUR_MS,
        ),
      ),
      medianLines: median(c.rows.map((p) => (p.additions ?? 0) + (p.deletions ?? 0))),
    };
  });
  agents.sort((a, b) => b.opened - a.opened || a.agent.localeCompare(b.agent));
  return { generatedAt, repo, since, attributed: who.size, agents };
}
