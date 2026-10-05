import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { Heat } from '../../../core/architecture/architecture-graph';
import { AIR_TOKEN, planetLook } from '../../../core/architecture/planet-look';
import { Planet, SUN_RADIUS, StarSystem } from '../../../core/architecture/star-layout';
import { MotionPreference } from '../../../core/motion/motion-preference';
import { StarType } from '../../../shared/gl/star-shader';
import { channelReader } from '../../../shared/night-sky/night-sky';
import { PlanetPortraits } from '../../../shared/planets/planet-portraits';
import {
  PortraitPainter,
  SUN_FRAME,
  WORLD_FRAME,
} from '../../../shared/planets/planet-portrait.types';

/** Image pixels per map unit: the map is usually drawn larger than its viewBox. */
const PIXELS_PER_UNIT = 3;
const MAX_PIXELS = 256;
/** Enough pictures for several systems; past it the cache starts over. */
const MAX_PAINTED = 400;
/** A plain sun burns clear in the orrery's colour; a hot spot is a flaring giant; an unused one rests. */
const SUN_LOOK: Readonly<Record<Heat, { type: StarType; token: string }>> = {
  plain: { type: 'bright', token: 'orrery-sun-body' },
  hot: { type: 'giant', token: AIR_TOKEN.hot },
  unused: { type: 'calm', token: AIR_TOKEN.unused },
};

interface Portraits {
  readonly sun: string;
  readonly planets: ReadonlyMap<string, string>;
}

/** One node as a sun: what it depends on and what depends on it turn round it, a ring per area. */
@Component({
  selector: 'app-star-view',
  templateUrl: './star-view.html',
  styleUrl: './star-view.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.still]': 'isStill()', '[class.real]': 'portraits() !== null' },
})
export class StarView {
  readonly system = input.required<StarSystem>();
  /** The id of the node to put at the centre next. */
  readonly pick = output<string>();

  protected readonly isStill = inject(MotionPreference).isStill;
  protected readonly sunRadius = SUN_RADIUS;
  protected readonly worldFrame = WORLD_FRAME;
  protected readonly sunFrame = SUN_FRAME;

  private readonly painter = inject(PlanetPortraits).painter();
  private readonly channels = channelReader(inject(ElementRef<HTMLElement>).nativeElement);
  /** Painting is the costly part, and recentring keeps most planets where they were. */
  private readonly painted = new Map<string, string>();

  /** A picture of each body, or null while there is no painter, so the flat bodies are drawn. */
  protected readonly portraits = computed<Portraits | null>(() => {
    const painter = this.painter();
    if (!painter) return null;
    const system = this.system();
    try {
      const planets = new Map<string, string>();
      for (const orbit of system.orbits) {
        for (const planet of orbit.planets) {
          planets.set(planet.entry.node.id, this.paintPlanet(painter, planet));
        }
      }
      return { sun: this.paintSun(painter, system.sun.heat), planets };
    } catch (error: unknown) {
      console.warn('A planet could not be painted; drawing flat bodies.', error);
      return null;
    }
  });

  private paintPlanet(painter: PortraitPainter, planet: Planet): string {
    const { node, heat } = planet.entry;
    const look = planetLook(node.id, planet.x, planet.y);
    const px = pixelsFor(planet.size * WORLD_FRAME);
    const turn = Math.round(Math.atan2(look.towardSun.y, look.towardSun.x) * 60);
    return this.once(`${node.id}|${heat}|${px}|${turn}`, () =>
      painter.world({ ...look, air: this.channels(`var(--${AIR_TOKEN[heat]})`), px }),
    );
  }

  private paintSun(painter: PortraitPainter, heat: Heat): string {
    const px = pixelsFor(SUN_RADIUS * SUN_FRAME);
    return this.once(`sun|${heat}|${px}`, () =>
      painter.sun({
        type: SUN_LOOK[heat].type,
        ink: this.channels(`var(--${SUN_LOOK[heat].token})`),
        px,
      }),
    );
  }

  private once(key: string, paint: () => string): string {
    let url = this.painted.get(key);
    if (url === undefined) {
      url = paint();
      if (this.painted.size >= MAX_PAINTED) this.painted.clear();
      this.painted.set(key, url);
    }
    return url;
  }
}

const pixelsFor = (halfWidth: number): number =>
  Math.min(MAX_PIXELS, Math.ceil(halfWidth * 2 * PIXELS_PER_UNIT));
