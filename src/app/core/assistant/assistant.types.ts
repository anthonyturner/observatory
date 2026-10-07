import { ReplyTier } from '../voice/reply-voice';

/** A fixed task the assistant proposes in one press, as the router lists it. */
export interface Skill {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  /** The project it runs in, when it names one. */
  readonly project?: string;
}

export type JevState = 'on' | 'off';

/** Where the API runs: this machine, or the hosted site. */
export type SiteWhere = 'local' | 'hosted';

/** What the router says about itself. */
export interface AssistantStatus {
  readonly jev: JevState;
  readonly where: SiteWhere;
  readonly skills: readonly Skill[];
}

/** A button the router offered. It goes back exactly as it came, so the
 *  router does what the button said. */
export type RoutePick = Readonly<Record<string, string | number | null>>;

/** One turn of the conversation so far: what was asked, or what Jev said. */
export interface HistoryTurn {
  readonly role: 'user' | 'assistant';
  readonly text: string;
}

/** One request: typed words, a pressed option for them, or a skill. Typed
 *  and spoken words carry the conversation they continue. */
export interface RouteRequest {
  readonly text?: string;
  readonly pick?: RoutePick;
  readonly skill?: string;
  readonly history?: readonly HistoryTurn[];
}

export interface AskOption {
  readonly label: string;
  readonly pick: RoutePick;
}

/** A tier-3 command, and the shell it is quoted for when the router says. */
export interface ShellCommand {
  readonly shell: string | null;
  readonly command: string;
}

/** A proposal the local runner will start once the owner presses Run. The
 *  token is single use, bound to the prompt and folder shown, and expires. */
export interface RunTicket {
  readonly token: string;
  readonly folder: string;
  /** The project's name for the folder. */
  readonly name: string;
  /** When the token stops working, in ms since the epoch. */
  readonly expiresAt: number;
  /** How long a run may go on before it is stopped. */
  readonly limitMs: number;
  /** The command it runs, without the prompt, which goes on stdin. */
  readonly command: string;
}

/** A page a web answer drew on. */
export interface Source {
  readonly title: string;
  readonly url: string;
}

/** The open pull request a Review Queue command is about. */
export interface OnePull {
  readonly repo: string;
  readonly pr: number;
}

/** A Review Queue command Jev chose, which the page carries out as it would
 *  the typed one: reading the queues itself, and asking before any change. */
export type QueueAct =
  | { readonly kind: 'blocking'; readonly repo: string | null }
  | (OnePull & { readonly kind: 'open' })
  | (OnePull & { readonly kind: 'dismiss' })
  | (OnePull & { readonly kind: 'crew' })
  | (OnePull & {
      readonly kind: 'snooze';
      readonly days: number;
      /** "till Monday 12 October". */
      readonly words: string;
    });

/** How the router reached its reply. */
export type ReplyVia = 'keyword' | 'agent' | 'pick' | 'skill';

/** The router's reply. Which fields come depends on what it decided. */
export interface RouteReply {
  readonly via?: ReplyVia;
  readonly jev?: JevState;
  readonly tier?: ReplyTier;
  readonly action?: string;
  /** An action the page carries out itself, such as `refresh`. */
  readonly op?: string;
  /** Where an action goes, and what it says as it goes. */
  readonly href?: string;
  readonly says?: string;
  readonly text?: string;
  /** The model Jev's answer came from. */
  readonly by?: string;
  /** Jev's answer drew on a web search. */
  readonly web?: boolean;
  /** The pages Jev's answer drew on. */
  readonly sources?: readonly Source[];
  readonly note?: string;
  readonly question?: string;
  readonly ask: readonly AskOption[];
  readonly prompt?: string;
  readonly commands: readonly ShellCommand[];
  readonly project?: string;
  /** Why the proposal can only be copied, not run here. */
  readonly runWhy?: string;
  /** Only the local site sends one: the proposal can run here. */
  readonly run?: RunTicket;
  /** A Review Queue command Jev chose, for the page to carry out. */
  readonly queue?: QueueAct;
}
