import { parseRgb, resolveColour } from '../../../core/instrument/palette';
import { FIELD_TINT_COUNT } from '../../../core/orrery/star-field';

/** The orrery's colours, resolved from tokens.css, since a canvas cannot
 *  read a CSS variable. Each is an `r, g, b` triple, so any alpha can be added. */
export interface OrreryPalette {
  readonly skyCentre: string;
  readonly skyMid: string;
  readonly skyEdge: string;
  readonly orbit: string;
  readonly dial: string;
  readonly sunBody: string;
  readonly sunCore: string;
  readonly sunGlow: string;
  readonly sunHalo: string;
  readonly sunRay: string;
  readonly sunInk: string;
  readonly worldLight: string;
  readonly worldShade: string;
  readonly moon: string;
  readonly comet: string;
  readonly cometHead: string;
  readonly select: string;
  readonly vignette: string;
  readonly ink: string;
  readonly muted: string;
  readonly stars: readonly string[];
  readonly fontSans: string;
  readonly fontMono: string;
  readonly fontSerif: string;
  /** Any CSS colour, `var()` included, as an `r, g, b` triple. */
  channels(expression: string): string;
}

/** `rgba()` from an `r, g, b` triple. */
export const rgba = (channels: string, alpha = 1): string => `rgba(${channels}, ${alpha})`;

export function readOrreryPalette(element: HTMLElement): OrreryPalette {
  const cache = new Map<string, string>();
  const channels = (expression: string): string => {
    const known = cache.get(expression);
    if (known) return known;
    const [r, g, b] = parseRgb(resolveColour(element, expression));
    const triple = `${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}`;
    cache.set(expression, triple);
    return triple;
  };
  const token = (name: string): string => channels(`var(--${name})`);
  const font = (name: string): string =>
    getComputedStyle(element).getPropertyValue(`--font-${name}`).trim();
  return {
    skyCentre: token('orrery-sky-centre'),
    skyMid: token('orrery-sky-mid'),
    skyEdge: token('orrery-sky-edge'),
    orbit: token('orrery-orbit'),
    dial: token('orrery-dial'),
    sunBody: token('orrery-sun-body'),
    sunCore: token('orrery-sun-core'),
    sunGlow: token('orrery-sun-glow'),
    sunHalo: token('orrery-sun-halo'),
    sunRay: token('orrery-sun-ray'),
    sunInk: token('orrery-sun-ink'),
    worldLight: token('orrery-world-light'),
    worldShade: token('orrery-world-shade'),
    moon: token('orrery-moon'),
    comet: token('orrery-comet'),
    cometHead: token('orrery-comet-head'),
    select: token('orrery-select'),
    vignette: token('orrery-vignette'),
    ink: token('ink'),
    muted: token('muted'),
    stars: Array.from({ length: FIELD_TINT_COUNT }, (_, index) =>
      token(`orrery-star-${index + 1}`),
    ),
    fontSans: font('sans'),
    fontMono: font('mono'),
    fontSerif: font('serif'),
    channels,
  };
}
