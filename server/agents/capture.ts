/* Records an agent handoff the moment it happens, so the report cards survive
   the session that produced them: pr-starmap's capture hook, for Observatory.

   Claude Code hands a hook a JSON payload on standard input and ignores what
   it writes. Add it to your Claude Code settings (see the README), for
   `PostToolUse` on Bash and PowerShell and for `SubagentStop`:

     node /path/to/observatory/server/agents/capture.ts

   Every failure is swallowed on purpose: a capture that breaks a tool call is
   worse than a handoff that goes unrecorded. */

import { readFileSync } from 'node:fs';
import type { Handoff } from './agents-report.ts';
import { type HandoffStore, fileHandoffStore } from './handoff-store.ts';

const PR_CREATE = /\bgh\s+pr\s+create\b/;
const PR_URL = /https:\/\/github\.com\/([^/\s]+\/[^/\s]+)\/pull\/(\d+)/;

/** A hook payload, as far as the capture reads it. */
export interface HookPayload {
  readonly hook_event_name?: string;
  readonly session_id?: string;
  readonly cwd?: string;
  readonly agent_type?: string;
  readonly subagent_type?: string;
  readonly tool_input?: { readonly command?: unknown };
  readonly tool_response?: unknown;
}

/** Flattens a tool payload of unknown shape into searchable text. */
function textOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(textOf).join('\n');
  if (value && typeof value === 'object') return Object.values(value).map(textOf).join('\n');
  return '';
}

/** What a hook event records, if anything: a pull request opened, or an agent that finished. */
export function handoffOf(payload: HookPayload, now: number): Handoff | null {
  const event = payload.hook_event_name ?? '';
  const common = {
    at: new Date(now).toISOString(),
    session: payload.session_id ?? null,
    cwd: payload.cwd,
    // Newer Claude Code builds name the agent; older ones do not. Null rather
    // than a guess, so "unknown" stays apart from "main".
    agent: payload.agent_type ?? payload.subagent_type ?? null,
  };
  if (event === 'PostToolUse') {
    if (!PR_CREATE.test(textOf(payload.tool_input?.command ?? ''))) return null;
    const match = PR_URL.exec(textOf(payload.tool_response));
    if (!match) return null;
    return { ...common, kind: 'pr-opened', pr: Number(match[2]), url: match[0] };
  }
  if (event === 'SubagentStop' || event === 'Stop') {
    return { ...common, kind: event === 'Stop' ? 'session-stop' : 'agent-stop' };
  }
  return null;
}

/** Reads a payload and records its handoff. */
export function capture(raw: string, store: HandoffStore, now = Date.now()): void {
  if (!raw.trim()) return;
  const handoff = handoffOf(JSON.parse(raw) as HookPayload, now);
  if (handoff) store.append(handoff);
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('agents/capture.ts')) {
  try {
    capture(readFileSync(0, 'utf8'), fileHandoffStore());
  } catch {
    // Deliberately silent: see the note at the top of the file.
  }
}
