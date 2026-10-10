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
  groupAreas,
  neighbourhoodOf,
} from '../../../core/architecture/architecture-graph';
import { ArchitectureMap } from '../../../core/architecture/architecture.types';
import { Legend, legendOf } from '../../../core/architecture/kind-look';
import { starSystem } from '../../../core/architecture/star-layout';
import { umlDiagram } from '../../../core/architecture/uml-layout';
import { ProjectBarRoom } from '../../../shared/project-bar-room/project-bar-room';
import { plural } from '../../../shared/text/plural';
import { KindDot } from '../kind-dot/kind-dot';
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
  'The scan found no source code to map in this clone: no TypeScript files, routes or outside services.';

const HEAT_NOTE: Readonly<Record<Heat, string>> = {
  hot: 'Hot spot: among the most often changed files.',
  unused: 'Nothing depends on it: candidate dead code.',
  plain: '',
};

const NO_LIST: readonly string[] = [];
const NO_AREAS: ArchitectureMap['areas'] = [];
const NO_LEGEND: Legend = { nodes: [], links: [] };

function stampOf(repo: string, map: ArchitectureMap | null): string {
  if (!map) return repo;
  const scanned = new Date(map.scannedAt);
  const when = Number.isNaN(scanned.getTime())
    ? ''
    : ` · scanned ${scanned.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  return `${repo} · ${plural(map.nodes.length, 'node')} · ${plural(map.edges.length, 'link')}${when}`;
}

/**
 * A project's Architecture screen: the classes, modules, routes and outside services of
 * its local clone and how they join, as a star system or a dependency diagram.
 */
@Component({
  selector: 'app-architecture-page',
  imports: [ProjectBarRoom, KindDot, NodeIndex, StarView, UmlView],
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
  protected readonly areaGroups = computed(() => {
    const map = this.map();
    return map ? groupAreas(map.areas, map.runtimes) : [];
  });
  protected readonly legend = computed(() => {
    const map = this.map();
    return map ? legendOf(map) : NO_LEGEND;
  });
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
      kind: `${neighbourhood.centre.kindLabel} · ${area}${node.group ? ` / ${node.group}` : ''}`,
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
