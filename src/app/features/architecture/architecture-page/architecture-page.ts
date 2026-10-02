import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ARCHITECTURE_STATE } from '../../../core/architecture/architecture-feed';
import {
  Heat,
  MapEntry,
  Scope,
  countOf,
  entriesMatching,
  graphOf,
  neighbourhoodOf,
} from '../../../core/architecture/architecture-graph';
import {
  ArchitectureMap,
  EDGE_KINDS,
  MAP_SCHEMA,
} from '../../../core/architecture/architecture.types';
import { starSystem } from '../../../core/architecture/star-layout';
import { umlDiagram } from '../../../core/architecture/uml-layout';
import { UpLink } from '../../../shared/up-link/up-link';
import { NodeIndex } from '../node-index/node-index';
import { StarView } from '../star-view/star-view';
import { UmlView } from '../uml-view/uml-view';

type ViewChoice = 'star' | 'uml';

/** What the page says in place of the map, by where the map stands. */
const WAITING_MESSAGE = {
  reading: 'Reading the architecture map…',
  missing: 'No architecture map yet. Run npm run arch:scan -- <project folder>, then reload.',
  unreachable: 'Architecture map out of reach: is the API running (npm start)?',
} as const;

const RESCAN_NOTE =
  'This map is from an older scan, without component links or windows. Run npm run arch:scan again, then reload.';

const HEAT_NOTE: Readonly<Record<Heat, string>> = {
  hot: 'Hot spot: a change here is felt widely.',
  unused: 'Nothing depends on it: candidate dead code.',
  plain: '',
};

const NO_LIST: readonly string[] = [];
const NO_AREAS: ArchitectureMap['areas'] = [];

function stampOf(map: ArchitectureMap): string {
  const scanned = new Date(map.scannedAt);
  const when = Number.isNaN(scanned.getTime()) ? '' : ` · scanned ${scanned.toLocaleDateString()}`;
  return `${map.project} · ${map.nodes.length} nodes · ${map.edges.length} links${when}`;
}

/** A project's classes and how they depend on each other, as a star system or a dependency diagram. */
@Component({
  selector: 'app-architecture-page',
  imports: [UpLink, NodeIndex, StarView, UmlView],
  templateUrl: './architecture-page.html',
  styleUrl: './architecture-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArchitecturePage {
  private readonly state = inject(ARCHITECTURE_STATE);
  private readonly map = computed(() => {
    const state = this.state();
    return state.status === 'ready' ? state.map : null;
  });
  private readonly chosen = signal<string | null>(null);

  protected readonly linkKinds = EDGE_KINDS;
  protected readonly view = signal<ViewChoice>('star');
  protected readonly query = signal('');
  protected readonly area = signal<string | null>(null);
  protected readonly window = signal<string | null>(null);
  protected readonly heat = signal<Heat | null>(null);

  protected readonly waiting = computed(() => {
    const state = this.state();
    if (state.status !== 'ready') return WAITING_MESSAGE[state.status];
    return state.map.nodes.length ? null : 'The map is empty: the scan found no Angular classes.';
  });
  protected readonly stamp = computed(() => {
    const map = this.map();
    return map ? stampOf(map) : '';
  });
  protected readonly rescanNote = computed(() => {
    const map = this.map();
    return map && map.schema < MAP_SCHEMA ? RESCAN_NOTE : null;
  });
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

  protected centreOn(id: string): void {
    this.chosen.set(id);
  }
}
