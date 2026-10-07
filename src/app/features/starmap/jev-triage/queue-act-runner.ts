import { Injectable, computed, inject } from '@angular/core';
import { QueueAct } from '../../../core/assistant/assistant.types';
import { PROJECTS_STATE } from '../../../core/projects/projects-source';
import { CrewVoice } from './crew-voice';
import { NamedProject } from './project-mention';
import { pullItemOf, readProjectsOf } from './project-pulls';
import { QueueCommand } from './queue-command';
import { NOT_READ_YET, QueueReply, notOpenWords } from './queue-reply';
import { pullNameOf } from './queue-top';
import { QueueTriage } from './queue-triage';

type PullAct = Extract<QueueAct, { readonly kind: 'open' | 'crew' }>;
type CommandAct = Exclude<QueueAct, PullAct>;

const isPullAct = (act: QueueAct): act is PullAct => act.kind === 'open' || act.kind === 'crew';

/**
 * Carries out a Review Queue command Jev chose by the paths the typed command
 * takes: QueueTriage reads the queues and asks before a snooze or a
 * dismissal, CrewVoice checks and asks before a crew goes, and a pull request
 * opens after the grace second, with Stay here.
 */
@Injectable({ providedIn: 'root' })
export class QueueActRunner {
  private readonly projectsState = inject(PROJECTS_STATE);
  private readonly triage = inject(QueueTriage);
  private readonly crews = inject(CrewVoice);
  private readonly replies = inject(QueueReply);

  private readonly projects = computed(() => readProjectsOf(this.projectsState()));

  /** Answers `act` in reply `entryId`. */
  carryOut(entryId: number, act: QueueAct): void {
    if (isPullAct(act)) this.onPull(entryId, act);
    else this.triage.run(entryId, this.commandOf(act));
  }

  /** The command typing it would have given. */
  private commandOf(act: CommandAct): QueueCommand {
    if (act.kind === 'blocking') {
      return { kind: 'blocking', project: act.repo === null ? null : this.projectOf(act.repo) };
    }
    const project = this.projectOf(act.repo);
    if (act.kind === 'dismiss') return { kind: 'dismiss', pr: act.pr, project };
    return { kind: 'snooze', pr: act.pr, until: { days: act.days, words: act.words }, project };
  }

  /** The project `repo` is, named as the page names it, else by its repository. */
  private projectOf(repo: string): NamedProject {
    return { name: this.projects()?.find((each) => each.repo === repo)?.name ?? repo, repo };
  }

  private onPull(entryId: number, act: PullAct): void {
    const projects = this.projects();
    if (!projects) return this.replies.say(entryId, NOT_READ_YET);
    const project = projects.find((each) => each.repo === act.repo);
    const open = project?.openPulls?.find((pull) => pull.number === act.pr);
    if (!project || !open) {
      return this.replies.say(entryId, notOpenWords(act.pr, project?.name ?? act.repo));
    }
    const pull = pullItemOf(project, act.pr, open.title);
    if (act.kind === 'crew') return this.crews.check(entryId, pull);
    this.replies.jump(entryId, pull.href, `Opening ${pullNameOf(project, act.pr, open.title)}`);
  }
}
