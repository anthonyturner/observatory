import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { DevServerStatus } from '../../core/dev-servers/dev-server.types';
import { RunPreview } from '../../core/dev-servers/run-preview';
import { ViewerSession } from '../../core/session/viewer-session';

/** What the buttons and the note beside them show for one status. */
interface PreviewView {
  readonly canRun: boolean;
  readonly isStarting: boolean;
  /** Where the running site is; null until it is. */
  readonly openUrl: string | null;
  readonly canStop: boolean;
  readonly note: string;
  readonly isProblem: boolean;
}

const WEB_SCHEME = /^https?:\/\//;
const TAB_BLOCKED_NOTE =
  'Your browser blocked the new tab — allow pop-ups for Observatory to open sites automatically.';

function viewOf(status: DevServerStatus, isTabBlocked: boolean): PreviewView {
  const none = { canRun: false, isStarting: false, openUrl: null, canStop: false };
  switch (status.state) {
    case 'stopped':
      return { ...none, canRun: true, note: '', isProblem: false };
    case 'failed':
      return { ...none, canRun: true, note: status.reason, isProblem: true };
    case 'starting':
      return {
        ...none,
        isStarting: true,
        canStop: true,
        note: 'Starting the dev server…',
        isProblem: false,
      };
    case 'running':
      return {
        ...none,
        openUrl: status.url,
        canStop: true,
        note: isTabBlocked ? TAB_BLOCKED_NOTE : `Running at ${status.url.replace(WEB_SCHEME, '')}`,
        isProblem: false,
      };
  }
}

/**
 * Runs a project's dev server on this machine and opens its site in a new tab
 * once the site answers: Run, then Starting, then Open and Stop. If the browser
 * blocks the tab, Open stays and a note says how to allow it. It is there only
 * once the API has confirmed this is the owner's own machine (ADR-0006,
 * ADR-0010); a hosted session never sees it or asks for it.
 */
@Component({
  selector: 'app-run-preview-button',
  templateUrl: './run-preview-button.html',
  styleUrl: './run-preview-button.css',
  providers: [RunPreview],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RunPreviewButton {
  /** `owner/name`. */
  readonly repo = input.required<string>();

  private readonly preview = inject(RunPreview);
  protected readonly isLocal = inject(ViewerSession).isConfirmedLocal;
  protected readonly view = computed(() =>
    viewOf(this.preview.status(), this.preview.isTabBlocked()),
  );

  constructor() {
    effect(() => {
      const repo = this.repo();
      if (this.isLocal()) untracked(() => this.preview.watch(repo));
    });
  }

  protected run(): void {
    this.preview.run();
  }

  protected stop(): void {
    this.preview.stop();
  }
}
