import type { ActableId, PageOp } from './actions.ts';
import type { ShellCommand } from './shell-commands.ts';

/** The longest request routed, and the longest prompt a skill may hold. */
export const MAX_REQUEST_LENGTH = 2000;

/** Where the site runs: only the local one can turn a proposal into a run. */
export type Where = 'local' | 'hosted';

export type JevSwitch = 'on' | 'off';

/** A project a request can name: its star map is at `href`. */
export interface Project {
  readonly name: string;
  readonly repo: string;
  readonly href: string;
}

/** A button the page offered, pressed: an action, or a tier, and maybe a project. */
export interface Pick {
  readonly action?: ActableId;
  /** `web`: look it up on the web; a quick answer, with sources. */
  readonly tier?: 2 | 3 | 'web';
  readonly project?: string | null;
}

/** A button to offer. */
export interface Choice {
  readonly label: string;
  readonly pick: Pick;
}

/** What `POST /api/route` accepts: a skill's id, or typed words and maybe a pick. */
export type RouteRequest =
  | { readonly skill: string; readonly pick: Pick | null }
  | { readonly skill: null; readonly text: string; readonly pick: Pick | null };

/** A proposal turned into a run the owner can confirm, as the local runner offers it. */
export interface RunTicket {
  readonly token: string;
  readonly folder: string;
  readonly name: string;
  readonly expiresAt: number;
  readonly limitMs: number;
  readonly command: string;
}

/** A run for a proposal; or, with no repository named, the repositories it
 *  could run in; or, with neither, why not. */
export interface RunOffer {
  readonly run?: RunTicket;
  readonly choose?: readonly string[];
  readonly why?: string;
}

/** What turns a tier-3 proposal into a run on this machine. */
export interface ProposalRunner {
  offer(request: { readonly prompt: string; readonly repo: string | null }): Promise<RunOffer>;
}

export type ActionReply =
  | { readonly tier: 1; readonly action: ActableId; readonly op: PageOp }
  | { readonly tier: 1; readonly action: ActableId; readonly href: string; readonly says: string }
  | { readonly tier: 1; readonly action: ActableId; readonly text: string };

/** A question with buttons, when the request could mean more than one thing. */
export interface AskReply {
  readonly tier?: 3;
  readonly action?: ActableId;
  readonly note?: string;
  readonly question: string | null;
  readonly ask: readonly Choice[];
}

/** A page a web answer drew on. */
export interface Source {
  readonly title: string;
  readonly url: string;
}

/** A tier-2 answer. `web` marks one looked up on the web, with its `sources`. */
export type QuickReply =
  | {
      readonly tier: 2;
      readonly label: string;
      readonly by: string;
      readonly text: string;
      readonly web?: true;
      readonly sources?: readonly Source[];
    }
  | { readonly tier: 2; readonly failed: string; readonly web?: true };

/** Work in a project, only ever proposed: `command` is the first of `commands`. */
export interface Proposal {
  readonly tier: 3;
  readonly prompt: string;
  readonly command: string;
  readonly commands: readonly ShellCommand[];
  readonly project: string | null;
  readonly run?: RunTicket;
  /** Why there is no run, when a runner was asked for one. */
  readonly runWhy?: string;
}

/** A skill that cannot be proposed, and why. */
export interface NoteReply {
  readonly note: string;
}

export type Reply = ActionReply | AskReply | QuickReply | Proposal | NoteReply;

/** How a reply was reached. */
export type Via = 'keyword' | 'jev' | 'pick' | 'skill';

export type RouteReply = Reply & {
  readonly via: Via;
  readonly jev: JevSwitch;
  readonly skill?: string;
  /** How sure Jev was of the tier, when Jev chose. */
  readonly confidence?: number;
};

/** One skill tile: the page shows no prompt until the proposal does. */
export interface SkillTile {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly project: string | null;
}

/** What `GET /api/route` answers. */
export interface AssistantStatus {
  readonly jev: JevSwitch;
  readonly where: Where;
  readonly skills: readonly SkillTile[];
}
