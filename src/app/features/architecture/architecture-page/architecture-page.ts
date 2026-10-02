import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ARCHITECTURE_STATE } from '../../../core/architecture/architecture-feed';
import {
  Heat,
  MapEntry,
  countOf,
  entriesMatching,
  graphOf,
  neighbourhoodOf,
} from '../../../core/architecture/architecture-graph';
import { ArchitectureMap } from '../../../core/architecture/architecture.types';
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

const HEAT_NOTE: Readonly<Record<Heat, string>> = {
  hot: 'Hot spot: a change here is felt widely.',
  unused: 'Nothing injects it: candidate dead code.',
  plain: '',
};

const NO_AREAS: ArchitectureMap['areas'] = [];

function stampOf(map: ArchitectureMap): string {
  const scanned = new Date(map.scannedAt);
  const when = Number.isNaN(scanned.getTime()) ? '' : ` · scanned ${scanned.toLocaleDateString()}`;
  return `${map.project} · ${map.nodes.length} classes · ${map.edges.length} injections${when}`;
}

/** A project's services and what injects them, as a star system or a dependency diagram. */
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

  protected readonly view = signal<ViewChoice>('star');
  protected readonly query = signal('');
  protected readonly area = signal<string | null>(null);
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
  protected readonly areas = computed(() => this.map()?.areas ?? NO_AREAS);
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
  protected readonly listed = computed((): readonly MapEntry[] => {
    const graph = this.graph();
    if (!graph) return [];
    return entriesMatching(graph, { query: this.query(), area: this.area(), heat: this.heat() });
  });
  /** The class picked, or the most depended-on one until something is. */
  protected readonly centreName = computed(
    () => this.chosen() ?? this.graph()?.entries[0]?.node.name ?? null,
  );
  private readonly neighbourhood = computed(() => {
    const [graph, name] = [this.graph(), this.centreName()];
    return graph && name ? neighbourhoodOf(graph, name, this.area()) : null;
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
      counts: `Injected by ${neighbourhood.dependents.length} · injects ${neighbourhood.dependencies.length}`,
      heat,
      note: HEAT_NOTE[heat],
    };
  });

  protected centreOn(name: string): void {
    this.chosen.set(name);
  }
}
