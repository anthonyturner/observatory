import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DepthChart, Planet } from '../../../core/depth/depth-chart';
import { DepthModule, Verdict } from '../../../core/depth/depth.types';
import { spokenSummary } from '../../../core/depth/depth-words';

/** A folder disc this big or bigger carries its name. */
const LABEL_FROM_RADIUS = 30;
const LABEL_DROP = 11;
/** The focus ring stands this far outside a planet's shell. */
const HALO_MARGIN = 3;
const PLANET_SELECTOR = 'g[data-planet]';

/** Where each key moves the focus, given where it is and the last planet. */
const KEY_STEPS: Readonly<Record<string, (at: number, last: number) => number>> = {
  ArrowRight: (at, last) => Math.min(at + 1, last),
  ArrowDown: (at, last) => Math.min(at + 1, last),
  ArrowLeft: (at) => Math.max(at - 1, 0),
  ArrowUp: (at) => Math.max(at - 1, 0),
  Home: () => 0,
  End: (_, last) => last,
};

interface PlanetView {
  readonly module: DepthModule;
  readonly verdict: Verdict;
  readonly transform: string;
  readonly core: number;
  readonly shell: number;
  readonly halo: number;
  readonly label: string;
}

interface SystemView {
  readonly folder: string;
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly name: string;
  readonly labelY: number;
  readonly isLabelled: boolean;
}

const viewOfPlanet = (planet: Planet): PlanetView => ({
  module: planet.module,
  verdict: planet.module.verdict,
  transform: `translate(${planet.x} ${planet.y})`,
  core: planet.core,
  shell: planet.shell,
  halo: planet.shell + HALO_MARGIN,
  label: spokenSummary(planet.module),
});

/**
 * The modules as a sky: a core for the work each hides, inside a ring for its
 * interface. Hovering or focusing a planet reports it; the arrow keys walk
 * them from a single tab stop.
 */
@Component({
  selector: 'app-depth-map',
  templateUrl: './depth-map.html',
  styleUrl: './depth-map.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DepthMap {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly chart = input.required<DepthChart>();
  /** The file of the module the screen is showing, which stays lit. */
  readonly active = input<string | null>(null);
  readonly activate = output<DepthModule>();

  /** The one planet in the tab order; the rest are reached with the arrow keys. */
  protected readonly tabStop = signal(0);

  protected readonly viewBox = computed(() => {
    const { x, y, width, height } = this.chart().box;
    return `${x} ${y} ${width} ${height}`;
  });
  protected readonly systems = computed((): readonly SystemView[] =>
    this.chart().systems.map(({ folder, name, x, y, r }) => ({
      folder,
      name,
      x,
      y,
      r,
      labelY: y + r + LABEL_DROP,
      isLabelled: r >= LABEL_FROM_RADIUS,
    })),
  );
  protected readonly planets = computed((): readonly PlanetView[] =>
    this.chart().planets.map(viewOfPlanet),
  );
  /** The tab stop, kept on a planet when a filter leaves fewer than it was on. */
  protected readonly tabbable = computed(() => Math.min(this.tabStop(), this.planets().length - 1));

  protected focused(index: number, module: DepthModule): void {
    this.tabStop.set(index);
    this.activate.emit(module);
  }

  protected walk(event: KeyboardEvent): void {
    const step = KEY_STEPS[event.key];
    if (!step) return;
    const planets = [...this.host.nativeElement.querySelectorAll<SVGGElement>(PLANET_SELECTOR)];
    const at = event.target instanceof SVGGElement ? planets.indexOf(event.target) : -1;
    if (at === -1) return;
    event.preventDefault();
    planets[step(at, planets.length - 1)]?.focus();
  }
}
