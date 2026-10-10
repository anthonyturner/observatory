import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { map } from 'rxjs';
import { SecurityFeed } from '../../../core/security/security-feed';
import { worstSeverity } from '../../../core/security/security-report';
import { ProjectBarRoom } from '../../../shared/project-bar-room/project-bar-room';
import { SkyInsets } from '../../releases/release-sky/release-sky';
import { PageMessage } from '../../releases/releases-page/releases-words';
import { AlertList } from '../alert-list/alert-list';
import { AlertSources } from '../alert-sources/alert-sources';
import { hazardsOf } from '../hazard-sky/hazard-belts';
import { HazardSky } from '../hazard-sky/hazard-sky';
import {
  ALERT_KIND_LEGEND,
  WITHHELD_NOTE,
  emptyMessage,
  securityStamp,
  severityLegend,
  stateMessage,
  unreadNote,
} from '../security-words';

type SecurityView = 'list' | 'sky';

/** The header's height, with its legend, which the belts keep clear of. */
const SKY_INSETS: SkyInsets = { top: 190, right: 0, bottom: 100, left: 0 };

const repoOf = (params: ParamMap): string =>
  `${params.get('owner') ?? ''}/${params.get('repo') ?? ''}`;

/**
 * A project's Security screen: its open Dependabot, code-scanning and
 * secret-scanning alerts as one triage list, most severe first, or as hazards
 * round its world; each list's count, or why it could not be read, above.
 */
@Component({
  selector: 'app-security-page',
  imports: [ProjectBarRoom, AlertSources, AlertList, HazardSky],
  providers: [SecurityFeed],
  templateUrl: './security-page.html',
  styleUrls: ['../../releases/releases-page/releases-page.css', './security-page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecurityPage {
  private readonly feed = inject(SecurityFeed);
  private readonly repoChanges = inject(ActivatedRoute).paramMap.pipe(map(repoOf));

  protected readonly repo = toSignal(this.repoChanges, { initialValue: '' });
  /** A triage list first: the sky is the same alerts at a glance. */
  protected readonly view = signal<SecurityView>('list');
  protected readonly insets = SKY_INSETS;
  protected readonly kinds = ALERT_KIND_LEGEND;
  protected readonly withheldNote = WITHHELD_NOTE;

  protected readonly report = computed(() => {
    const state = this.feed.state();
    return state.status === 'ready' ? state.report : null;
  });
  protected readonly hazards = computed(() => {
    const report = this.report();
    return report ? hazardsOf(report) : [];
  });
  protected readonly worst = computed(() => {
    const report = this.report();
    return report ? worstSeverity(report) : null;
  });
  protected readonly message = computed((): PageMessage | null => {
    const report = this.report();
    return stateMessage(this.feed.state()) ?? (report ? emptyMessage(report) : null);
  });
  protected readonly unread = computed(() => {
    const report = this.report();
    return report ? unreadNote(report.sources) : null;
  });
  protected readonly stamp = computed(() => securityStamp(this.repo(), this.report()));
  protected readonly legend = computed(() => severityLegend(this.report()?.sources ?? []));

  constructor() {
    this.repoChanges.pipe(takeUntilDestroyed()).subscribe((repo) => this.feed.load(repo));
  }
}
