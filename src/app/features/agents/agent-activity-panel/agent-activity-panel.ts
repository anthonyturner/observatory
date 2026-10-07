import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { startWith, switchMap } from 'rxjs';
import { AgentActivity, activityEveryMs } from '../../../core/live-agents/agent-activity';
import { ActivityState } from '../../../core/live-agents/agent-feed.types';
import { LiveAgent, LiveAgentKey } from '../../../core/live-agents/live-agents.types';
import { RunTranscript } from '../../home/run-dock/run-transcript/run-transcript';
import { LocalOnlyNote } from '../local-only-note/local-only-note';

const READING: ActivityState = { status: 'reading' };
/** Within this far of the bottom still counts as reading the latest. */
const PINNED_SLACK_PX = 24;

const sameKey = (a: LiveAgentKey, b: LiveAgentKey): boolean =>
  a.session === b.session && a.agentId === b.agentId;

/**
 * An agent's Activity tab: what it says and does, as it does it. New rows
 * arrive at the bottom, and the view follows them unless the reader has
 * scrolled up, when Jump to latest brings them back.
 */
@Component({
  selector: 'app-agent-activity-panel',
  imports: [RunTranscript, LocalOnlyNote],
  templateUrl: './agent-activity-panel.html',
  styleUrl: './agent-activity-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentActivityPanel {
  readonly agent = input.required<LiveAgent>();

  private readonly activity = inject(AgentActivity);
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  /** Only a different agent restarts the feed; a fresh read of the same one does not. */
  private readonly key = computed(
    (): LiveAgentKey => ({ session: this.agent().session, agentId: this.agent().agentId }),
    { equal: sameKey },
  );
  private readonly everyMs = toObservable(computed(() => activityEveryMs(this.agent().state)));

  protected readonly state = toSignal(
    toObservable(this.key).pipe(
      switchMap((key) => this.activity.follow(key, this.everyMs).pipe(startWith(READING))),
    ),
    { initialValue: READING },
  );
  protected readonly isPinned = signal(true);

  constructor() {
    afterRenderEffect({
      write: () => {
        // Read only so that every new page of rows runs this again.
        this.state();
        const scroller = this.scroller()?.nativeElement;
        if (scroller && this.isPinned()) scroller.scrollTop = scroller.scrollHeight;
      },
    });
  }

  protected onScroll(): void {
    const scroller = this.scroller()?.nativeElement;
    if (!scroller) return;
    const fromBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    this.isPinned.set(fromBottom <= PINNED_SLACK_PX);
  }

  protected jumpToLatest(): void {
    this.isPinned.set(true);
  }
}
