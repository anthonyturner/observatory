import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { map } from 'rxjs';
import { DepthFeed } from '../../../core/depth/depth-feed';
import { depthChart } from '../../../core/depth/depth-chart';
import { modulesMatching, verdictCounts } from '../../../core/depth/depth-modules';
import { DepthModule, Verdict } from '../../../core/depth/depth.types';
import { ProjectBarRoom } from '../../../shared/project-bar-room/project-bar-room';
import { PageMessage } from '../../releases/releases-page/releases-words';
import { DepthDetail } from '../depth-detail/depth-detail';
import { DepthList } from '../depth-list/depth-list';
import { DepthMap } from '../depth-map/depth-map';
import { depthStamp, emptyMessage, stateMessage } from './depth-page-words';

type DepthView = 'map' | 'list';

interface VerdictChip {
  readonly verdict: Verdict | null;
  readonly label: string;
  readonly count: number;
  readonly isOn: boolean;
}

const repoOf = (params: ParamMap): string =>
  `${params.get('owner') ?? ''}/${params.get('repo') ?? ''}`;

const CHIP_LABELS: readonly (readonly [Verdict | null, string])[] = [
  [null, 'All'],
  ['deep', 'Deep'],
  ['balanced', 'Balanced'],
  ['shallow', 'Shallow'],
];

/**
 * A project's Depth screen: every module of its local clone as a planet, or as
 * a list, with the numbers and the design idea of the one in view beside it.
 */
@Component({
  selector: 'app-depth-page',
  imports: [ProjectBarRoom, DepthMap, DepthList, DepthDetail],
  providers: [DepthFeed],
  templateUrl: './depth-page.html',
  styleUrls: ['../../releases/releases-page/releases-page.css', './depth-page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DepthPage {
  private readonly feed = inject(DepthFeed);
  private readonly route = inject(ActivatedRoute);

  private readonly repoChanges = this.route.paramMap.pipe(map(repoOf));
  protected readonly repo = toSignal(this.repoChanges, { initialValue: '' });
  protected readonly view = signal<DepthView>('map');
  protected readonly query = signal('');
  protected readonly verdict = signal<Verdict | null>(null);
  /** The module the pointer or the focus last reached; it stays lit until another is. */
  protected readonly active = signal<DepthModule | null>(null);

  private readonly report = computed(() => {
    const state = this.feed.state();
    return state.status === 'ready' ? state.report : null;
  });
  /** The modules the query lets through, whatever their verdict: what the chips count. */
  private readonly queried = computed(() => {
    const report = this.report();
    return report ? modulesMatching(report.modules, { query: this.query(), verdict: null }) : [];
  });
  protected readonly shown = computed(() =>
    modulesMatching(this.queried(), { query: '', verdict: this.verdict() }),
  );
  protected readonly chips = computed((): readonly VerdictChip[] => {
    const counts = verdictCounts(this.queried());
    return CHIP_LABELS.map(([verdict, label]) => ({
      verdict,
      label,
      count: verdict === null ? this.queried().length : counts[verdict],
      isOn: verdict === this.verdict(),
    }));
  });
  protected readonly chart = computed(() => depthChart(this.shown()));

  protected readonly message = computed((): PageMessage | null => {
    const report = this.report();
    return stateMessage(this.feed.state()) ?? (report && emptyMessage(report, this.shown().length));
  });
  protected readonly stamp = computed(() => depthStamp(this.repo(), this.report()));
  protected readonly hasReport = computed(() => this.report() !== null);

  protected readonly activeFile = computed(() => this.active()?.file ?? null);
  protected readonly principle = computed(() => {
    const [module, report] = [this.active(), this.report()];
    return module && report
      ? (report.principles.find(({ id }) => id === module.principle) ?? null)
      : null;
  });

  constructor() {
    this.repoChanges.pipe(takeUntilDestroyed()).subscribe((repo) => {
      this.active.set(null);
      this.feed.load(repo);
    });
  }

  protected show(module: DepthModule): void {
    this.active.set(module);
  }

  protected search(event: Event): void {
    if (event.target instanceof HTMLInputElement) this.query.set(event.target.value);
  }

  protected refresh(): void {
    this.feed.refresh();
  }
}
