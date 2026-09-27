import type { ActableId, PageOp } from './actions.ts';
import type { ShellCommand } from './shell-commands.ts';

/** The longest request routed, and the longest prompt a skill may hold. */
export const MAX_REQUEST_LENGTH = 2000;

/** The most turns of the conversation so far a request may carry, and the
 *  longest each may be. The page keeps them; the server keeps nothing. */
export const MAX_HISTORY_TURNS = 12;
export const MAX_TURN_LENGTH = 2000;

/** Where the site runs: only the local one can turn a proposal into a run. */
export type Where = 'local' | 'hosted';

export type JevSwitch = 'on' | 'off';

/** A project a request can name: its star map is at `href`. */
export interface Project {
  readonly name: string;
  readonly repo: string;
  readonly href: string;
}

/** A button the page offered, pressed: an action, or a task, and maybe a project. */
export interface Pick {
  readonly action?: ActableId;
  readonly tier?: 3;
  readonly project?: string | null;
}

/** A button to offer. */
export interface Choice {
  readonly label: string;
  readonly pick: Pick;
}

/** One turn of the conversation so far, as the page kept it. */
export interface HistoryTurn {
  readonly role: 'user' | 'assistant';
  readonly text: string;
}

/** What `POST /api/route` accepts: a skill's id, or typed words, maybe a
 *  pick, and the conversation they continue. */
export type RouteRequest =
  | { readonly skill: string; readonly pick: Pick | null }
  | {
      readonly skill: null;
      readonly text: string;
      readonly pick: Pick | null;
      readonly history: readonly HistoryTurn[];
    };

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

/** Jev's own answer in words; `by` names the model. */
export interface AnswerReply {
  readonly tier: 2;
  readonly label: string;
  readonly by: string;
  readonly text: string;
}

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
  /** What Jev said about it, when Jev proposed it. */
  readonly text?: string;
}

/** A skill that cannot be proposed, and why. */
export interface NoteReply {
  readonly note: string;
}

export type Reply = ActionReply | AskReply | AnswerReply | Proposal | NoteReply;

/** A page an answer drew on. */
export interface Source {
  readonly title: string;
  readonly url: string;
}

/** How a reply was reached. */
export type Via = 'keyword' | 'agent' | 'pick' | 'skill';

export type RouteReply = Reply & {
  readonly via: Via;
  readonly jev: JevSwitch;
  readonly skill?: string;
  /** The pages Jev's answer drew on, when it looked any up. */
  readonly sources?: readonly Source[];
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
