import { Injectable, signal } from '@angular/core';
import { MS_PER_MINUTE, wholeMinutes } from '../runs/run-words';
import { RouteReply, RunTicket, ShellCommand, SiteWhere } from './assistant.types';

/** One command on the card, with how its copy button and its box are named. */
export interface ProposalCommand extends ShellCommand {
  readonly copyLabel: string;
  readonly boxLabel: string;
}

/** A tier-3 task shown as the command to run it. */
export interface CommandProposal {
  readonly kind: 'command';
  /** Each proposal is new, so a card shown twice still takes the focus. */
  readonly id: number;
  /** Where and how to run it: "In your observatory folder, run:". */
  readonly intro: string;
  readonly commands: readonly ProposalCommand[];
  /** "Written for PowerShell or bash; not for cmd.exe." */
  readonly writtenFor: string;
  /** Why it can only be copied here, when the router says. */
  readonly runWhy: string | null;
}

/** A tier-3 task the local site runs once the owner presses Run: what would
 *  run, where and how, each on its own line, so nothing is taken on trust. */
export interface RunProposal {
  readonly kind: 'run';
  readonly id: number;
  /** The reply it answers, which says how it went. */
  readonly entryId: number;
  readonly prompt: string;
  readonly project: string | null;
  readonly ticket: RunTicket;
  /** "app · E:
epospp". */
  readonly where: string;
  /** Its permissions, its time limit and how long it stays valid. */
  readonly terms: string;
}

export type Proposal = CommandProposal | RunProposal;

/** Where a proposal to run came from: the reply, and the runner's ticket. */
export interface RunOrigin {
  readonly reply: RouteReply;
  readonly ticket: RunTicket;
  readonly prompt: string;
  readonly entryId: number;
}

/** The card that can start a run, as it reads at `now`. */
export function runProposalOf(origin: RunOrigin, id: number, now: number): RunProposal {
  const { ticket } = origin;
  const validMinutes = Math.max(1, Math.round((ticket.expiresAt - now) / MS_PER_MINUTE));
  return {
    kind: 'run',
    id,
    entryId: origin.entryId,
    prompt: origin.prompt,
    project: origin.reply.project ?? null,
    ticket,
    where: `${ticket.name} · ${ticket.folder}`,
    terms: `Runs with your own Claude Code permissions and hooks. Anything your allow rules don’t cover is refused, not asked. One run at a time; it stops after ${wholeMinutes(ticket.limitMs)} minutes. Valid for ${validMinutes} minutes.`,
  };
}

/** The card for `reply`. The hosted site cannot run anything, so it says the
 *  command is for your own machine; each command names the shell it is quoted
 *  for, since the hosted site cannot tell which you have. */
export function commandProposalOf(
  reply: RouteReply,
  where: SiteWhere | null,
  id: number,
): CommandProposal {
  const folder = reply.project
    ? `In your ${reply.project} folder, run:`
    : 'In the project’s folder, run:';
  const away = where === 'hosted' ? 'This runs on your own machine, not here. ' : '';
  const shells = reply.commands.map((command) => command.shell).filter((shell) => shell !== null);
  return {
    kind: 'command',
    id,
    intro: `${away}${folder}`,
    commands: reply.commands.map((command) => ({
      ...command,
      copyLabel: reply.commands.length > 1 ? `Copy for ${command.shell}` : 'Copy command',
      boxLabel: command.shell ? `Command for ${command.shell}` : 'Command',
    })),
    writtenFor: `Written for ${shells.join(' or ') || 'your shell'}; not for cmd.exe.`,
    runWhy: reply.runWhy ?? null,
  };
}

/** The one proposal on show above the replies, if any. */
@Injectable({ providedIn: 'root' })
export class ProposalSlot {
  private readonly shown = signal<Proposal | null>(null);
  private readonly heardLine = signal<string | null>(null);

  readonly proposal = this.shown.asReadonly();
  /** What was heard while the card was up, and why it was not sent. */
  readonly heard = this.heardLine.asReadonly();

  show(proposal: Proposal): void {
    this.shown.set(proposal);
    this.heardLine.set(null);
  }

  dismiss(): void {
    this.shown.set(null);
    this.heardLine.set(null);
  }

  /** Says on the card that `words` were heard and put in the box instead. */
  hear(words: string): void {
    const proposal = this.shown();
    if (proposal) this.heardLine.set(heardLineFor(proposal, words));
  }
}

/** Speech never starts a task: the card says the words wait in the box. */
function heardLineFor(proposal: Proposal, words: string): string {
  const said = words.replace(/[.!?]$/, '');
  return proposal.kind === 'run'
    ? `Heard “${said}”. Home never starts a run from speech. Press Run.`
    : `Heard “${said}”. Home never starts a task from speech, so it is in the box for you to send.`;
}
