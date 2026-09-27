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

/** One request: typed words, a pressed option for them, or a skill. */
export interface RouteRequest {
  readonly text?: string;
  readonly pick?: RoutePick;
  readonly skill?: string;
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

/** How the router reached its reply. */
export type ReplyVia = 'keyword' | 'jev' | 'pick' | 'skill';

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
  /** The model a quick answer came from. */
  readonly by?: string;
  /** Why a quick answer could not be had. */
  readonly failed?: string;
  /** A quick answer looked up on the web, or a lookup that failed. */
  readonly web?: boolean;
  /** The pages a web answer drew on. */
  readonly sources?: readonly Source[];
  readonly note?: string;
  readonly question?: string;
  readonly ask: readonly AskOption[];
  /** How sure Jev was of the tier, 0 to 1. */
  readonly confidence?: number;
  readonly prompt?: string;
  readonly commands: readonly ShellCommand[];
  readonly project?: string;
  /** Why the proposal can only be copied, not run here. */
  readonly runWhy?: string;
  /** Only the local site sends one: the proposal can run here. */
  readonly run?: RunTicket;
}
