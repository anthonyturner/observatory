import { Injectable, signal } from '@angular/core';
import { RouteReply, ShellCommand, SiteWhere } from './assistant.types';

/** One command on the card, with how its copy button and its box are named. */
export interface ProposalCommand extends ShellCommand {
  readonly copyLabel: string;
  readonly boxLabel: string;
}

/** A tier-3 task shown as the command to run it. The runner adds a second
 *  kind, a proposal that runs here once confirmed, beside this one. */
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

export type Proposal = CommandProposal;

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

  readonly proposal = this.shown.asReadonly();

  show(proposal: Proposal): void {
    this.shown.set(proposal);
  }

  dismiss(): void {
    this.shown.set(null);
  }
}
