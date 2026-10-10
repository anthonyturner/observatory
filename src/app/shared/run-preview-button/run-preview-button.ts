import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { LiveSites } from '../../core/deployments/live-sites';
import { DevServerStatus, StartPhase } from '../../core/dev-servers/dev-server.types';
import { RunPreviews } from '../../core/dev-servers/run-preview';
import { ViewerSession } from '../../core/session/viewer-session';

/** What the buttons and the note beside them show. */
interface PreviewView {
  readonly canRun: boolean;
  /** The disabled button while the server is on its way up; empty otherwise. */
  readonly progress: string;
  /** Where the running site is; null until it is. */
  readonly openUrl: string | null;
  readonly canStop: boolean;
  /** Whether a failed pull request's preview, which leaves its worktree on disk, can be cleared away. */
  readonly canRemove: boolean;
  /** The project's production site, offered where it cannot be run here; null otherwise. */
  readonly liveUrl: string | null;
  readonly note: string;
  readonly isProblem: boolean;
}

const NOTHING = {
  canRun: false,
  progress: '',
  openUrl: null,
  canStop: false,
  canRemove: false,
  liveUrl: null,
  note: '',
  isProblem: false,
};

/** What a server that has yet to answer is doing: the button's word, and the note beside it. */
const PHASE_WORDS: Readonly<
  Record<StartPhase, { readonly button: string; readonly note: string }>
> = {
  fetching: { button: 'Fetching…', note: 'Fetching the pull request…' },
  installing: {
    button: 'Installing…',
    note: 'Installing dependencies… this can take a few minutes.',
  },
  starting: { button: 'Starting…', note: 'Starting the dev server…' },
};

/** The words on the buttons, for a project's own server or for a pull request's. */
interface Labels {
  readonly group: string;
  readonly runText: string;
  readonly run: string;
  readonly open: string;
  readonly stop: string;
  readonly remove: string;
}

const WEB_SCHEME = /^https?:\/\//;
const TAB_BLOCKED_NOTE =
  'Your browser blocked the new tab — allow pop-ups for Observatory to open sites automatically.';

/** What a server this machine can run shows; null while it has yet to say whether it can. */
function runViewOf(
  status: DevServerStatus,
  isTabBlocked: boolean,
  isPull: boolean,
): PreviewView | null {
  switch (status.state) {
    case 'checking':
    case 'unavailable':
      return null;
    case 'stopped':
      return { ...NOTHING, canRun: true };
    case 'failed':
      return { ...NOTHING, canRun: true, canRemove: isPull, note: status.reason, isProblem: true };
    case 'starting': {
      const { button, note } = PHASE_WORDS[status.phase];
      return { ...NOTHING, progress: button, canStop: true, note };
    }
    case 'running':
      return {
        ...NOTHING,
        openUrl: status.url,
        canStop: true,
        note: isTabBlocked ? TAB_BLOCKED_NOTE : `Running at ${status.url.replace(WEB_SCHEME, '')}`,
      };
  }
}

/**
 * How to see a project's site, and the one place that decides it. With a
 * `pull` it previews that pull request's head instead: "Preview this PR" runs
 * it in a worktree, shows Fetching, Installing and Starting, and has no live
 * site to fall back on, so off the owner's machine, or for a project with no
 * checkout, it shows nothing. Without one: on the
 * owner's own machine, once the API has confirmed it (ADR-0006, ADR-0010), a
 * project with a checkout is run: Run, then Starting, then Open and Stop, the
 * site opening in a new tab once it answers. If the browser blocks the tab,
 * Open stays and a note says how to allow it. Where it cannot be run, on the
 * hosted site or for a project this machine has no checkout of, it is a link to
 * the project's production site; with none, a project with no checkout says
 * why it can't be run and a hosted one shows nothing. Beside a Run the
 * link would be a second way to open a site, so it is not shown.
 */
@Component({
  selector: 'app-run-preview-button',
  templateUrl: './run-preview-button.html',
  styleUrl: './run-preview-button.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RunPreviewButton {
  /** `owner/name`. */
  readonly repo = input.required<string>();
  /** The pull request to preview; absent for the project's own site. */
  readonly pull = input<number | undefined>(undefined);

  private readonly previews = inject(RunPreviews);
  private readonly isLocal = inject(ViewerSession).isConfirmedLocal;
  private readonly isHosted = inject(ViewerSession).isConfirmedHosted;
  private readonly liveSites = inject(LiveSites);
  /** The project's shared Run state; none unless this is the owner's own machine. */
  private readonly preview = computed(() =>
    this.isLocal() ? this.previews.runFor(this.repo(), this.pull()) : null,
  );
  /** Whether the production site stands in for a Run that is not to be had; a pull request's branch has none. */
  private readonly offersLiveSite = computed(
    () =>
      this.pull() === undefined &&
      (this.isHosted() || this.preview()?.status().state === 'unavailable'),
  );
  protected readonly labels = computed((): Labels => {
    const [repo, pull] = [this.repo(), this.pull()];
    return pull === undefined
      ? {
          group: `Site of ${repo}`,
          runText: 'Run',
          run: `Run ${repo}`,
          open: `Open ${repo} in a new tab`,
          stop: `Stop ${repo}`,
          remove: '',
        }
      : {
          group: `Preview of pull request ${pull} of ${repo}`,
          runText: 'Preview this PR',
          run: `Preview pull request ${pull} of ${repo}`,
          open: `Open the preview of pull request ${pull} in a new tab`,
          stop: `Stop the preview of pull request ${pull}`,
          remove: `Remove the preview of pull request ${pull}`,
        };
  });
  /** What to show; null where there is nothing to show. */
  protected readonly view = computed((): PreviewView | null => {
    const preview = this.preview();
    const status = preview?.status();
    const run =
      preview && status && runViewOf(status, preview.isTabBlocked(), this.pull() !== undefined);
    if (run) return run;
    if (!this.offersLiveSite()) return null;
    const liveUrl = this.liveSites.urlFor(this.repo());
    if (liveUrl) return { ...NOTHING, liveUrl };
    // Said once the sites are read, or the reason would show and then give way to the link.
    return status?.state === 'unavailable' && this.liveSites.isRead()
      ? { ...NOTHING, note: status.reason }
      : null;
  });

  constructor() {
    effect((onCleanup) => {
      const preview = this.preview();
      if (preview) onCleanup(untracked(() => preview.watch()));
    });
    effect(() => {
      if (this.offersLiveSite()) untracked(() => this.liveSites.load());
    });
  }

  protected run(): void {
    this.preview()?.run();
  }

  protected openedByHand(): void {
    this.preview()?.siteOpenedByHand();
  }

  protected stop(): void {
    this.preview()?.stop();
  }
}
