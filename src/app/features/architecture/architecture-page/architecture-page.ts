import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { map } from 'rxjs';
import {
  ArchitectureFeed,
  architectureHtmlUrl,
} from '../../../core/architecture/architecture-feed';
import {
  Heat,
  MapEntry,
  Scope,
  countOf,
  entriesMatching,
  graphOf,
  neighbourhoodOf,
} from '../../../core/architecture/architecture-graph';
import { ArchitectureMap, EDGE_KINDS } from '../../../core/architecture/architecture.types';
import { starSystem } from '../../../core/architecture/star-layout';
import { umlDiagram } from '../../../core/architecture/uml-layout';
import { ProjectTabs } from '../../../shared/project-tabs/project-tabs';
import { plural } from '../../../shared/text/plural';
import { UpLink } from '../../../shared/up-link/up-link';
import { NodeIndex } from '../node-index/node-index';
import { StarView } from '../star-view/star-view';
import { UmlView } from '../uml-view/uml-view';

type ViewChoice = 'star' | 'uml';

const repoOf = (params: ParamMap): string =>
  `${params.get('owner') ?? ''}/${params.get('repo') ?? ''}`;

/** What the page says in place of the map, by where the map stands. */
const WAITING_MESSAGE = {
  reading: 'Scanning the project…',
  missing:
    'No clone of this project here. The Architecture tab scans the code from a clone on this machine. Clone it beside Observatory, or list its folder in ~/.claude/observatory/clones.json.',
  unreachable:
    'Could not scan the project: is the API running (npm start)? Try Refresh in a moment.',
} as const;

const EMPTY_MESSAGE =
  'No Angular classes found in this clone. Open full map also charts plain TypeScript files, routes and outside services.';

const HEAT_NOTE: Readonly<Record<Heat, string>> = {
  hot: 'Hot spot: a change here is felt widely.',
  unused: 'Nothing depends on it: candidate dead code.',
  plain: '',
};

const NO_LIST: readonly string[] = [];
const NO_AREAS: ArchitectureMap['areas'] = [];

function stampOf(repo: string, map: ArchitectureMap | null): string {
  if (!map) return repo;
  const scanned = new Date(map.scannedAt);
  const when = Number.isNaN(scanned.getTime())
    ? ''
    : ` · scanned ${scanned.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  return `${repo} · ${plural(map.nodes.length, 'node')} · ${plural(map.edges.length, 'link')}${when}`;
}

/**
 * A project's Architecture screen: the classes of its local clone and how they
 * depend on each other, as a star system or a dependency diagram.
 */
@Component({
  selector: 'app-architecture-page',
  imports: [UpLink, ProjectTabs, NodeIndex, StarView, UmlView],
  providers: [ArchitectureFeed],
  templateUrl: './architecture-page.html',
  styleUrl: './architecture-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArchitecturePage {
  private readonly feed = inject(ArchitectureFeed);
  private readonly route = inject(ActivatedRoute);
  private readonly repoChanges = this.route.paramMap.pipe(map(repoOf));
  private readonly state = this.feed.state;
  private readonly map = computed(() => {
    const state = this.state();
    return state.status === 'ready' ? state.map : null;
  });
  private readonly chosen = signal<string | null>(null);

  protected readonly repo = toSignal(this.repoChanges, { initialValue: '' });
  protected readonly linkKinds = EDGE_KINDS;
  protected readonly view = signal<ViewChoice>('star');
  protected readonly query = signal('');
  protected readonly area = signal<string | null>(null);
  protected readonly window = signal<string | null>(null);
  protected readonly heat = signal<Heat | null>(null);

  protected readonly waiting = computed(() => {
    const state = this.state();
    if (state.status !== 'ready') return WAITING_MESSAGE[state.status];
    return state.map.nodes.length ? null : EMPTY_MESSAGE;
  });
  protected readonly stamp = computed(() => stampOf(this.repo(), this.map()));
  protected readonly fullMapUrl = computed(() => architectureHtmlUrl(this.repo()));
  protected readonly hasMap = computed(() => this.map() !== null);
  protected readonly areas = computed(() => this.map()?.areas ?? NO_AREAS);
  protected readonly windows = computed(() => this.map()?.windows ?? NO_LIST);
  protected readonly graph = computed(() => {
    const map = this.map();
    return map ? graphOf(map) : null;
  });
  protected readonly totals = computed(() => {
    const graph = this.graph();
    return graph
      ? { unused: countOf(graph, 'unused'), hot: countOf(graph, 'hot') }
      : { unused: 0, hot: 0 };
  });
  private readonly scope = computed((): Scope => ({ area: this.area(), window: this.window() }));
  protected readonly listed = computed((): readonly MapEntry[] => {
    const graph = this.graph();
    if (!graph) return [];
    return entriesMatching(graph, { ...this.scope(), query: this.query(), heat: this.heat() });
  });
  /** The node picked, or the most depended-on one until something is. */
  protected readonly centreId = computed(
    () => this.chosen() ?? this.graph()?.entries[0]?.node.id ?? null,
  );
  private readonly neighbourhood = computed(() => {
    const [graph, id] = [this.graph(), this.centreId()];
    return graph && id ? neighbourhoodOf(graph, id, this.scope()) : null;
  });
  protected readonly system = computed(() => {
    const neighbourhood = this.neighbourhood();
    return neighbourhood ? starSystem(neighbourhood, this.areas()) : null;
  });
  protected readonly diagram = computed(() => {
    const neighbourhood = this.neighbourhood();
    return neighbourhood ? umlDiagram(neighbourhood, this.areas()) : null;
  });
  protected readonly facts = computed(() => {
    const neighbourhood = this.neighbourhood();
    if (!neighbourhood) return null;
    const { node, heat } = neighbourhood.centre;
    const area = this.areas().find(({ id }) => id === node.area)?.label ?? node.area;
    return {
      name: node.name,
      kind: `${node.kind} · ${area}${node.group ? ` / ${node.group}` : ''}`,
      file: node.file,
      providedIn: node.providedIn,
      windows: node.windows.join(', '),
      counts: `Depended on by ${neighbourhood.dependents.length} · depends on ${neighbourhood.dependencies.length}`,
      heat,
      note: HEAT_NOTE[heat],
    };
  });

  constructor() {
    this.repoChanges.pipe(takeUntilDestroyed()).subscribe((repo) => {
      this.chosen.set(null);
      this.area.set(null);
      this.window.set(null);
      this.heat.set(null);
      this.query.set('');
      this.feed.load(repo);
    });
  }

  protected centreOn(id: string): void {
    this.chosen.set(id);
  }

  protected refresh(): void {
    this.feed.refresh();
  }
}
