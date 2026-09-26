import { CORE_INKS, CoreInk } from '../core-states';
import { Rgb } from '../core-look';

/** The core's colours, resolved from tokens.css, since a canvas cannot read a CSS variable. */
export interface CorePalette {
  readonly inks: Readonly<Record<CoreInk, Rgb>>;
  readonly floor: string;
  readonly ring: string;
  readonly heart: string;
  readonly mark: string;
  readonly markFont: string;
  /** Any CSS colour, `var()` included, as the canvas can take it. */
  colour(expression: string): string;
}

const RGB_CHANNELS = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/;
const WHITE: Rgb = [1, 1, 1];
const MARK_FONT_SIZE = '500 10.5px';

/** Reads the palette as it applies to `element`. */
export function readPalette(element: HTMLElement): CorePalette {
  const cache = new Map<string, string>();
  const colour = (expression: string): string => {
    const known = cache.get(expression);
    if (known) return known;
    const resolved = resolveColour(element, expression);
    cache.set(expression, resolved);
    return resolved;
  };
  const inkEntries = CORE_INKS.map((ink) => [ink, parseRgb(colour(`var(${ink})`))] as const);
  return {
    inks: Object.fromEntries(inkEntries) as Record<CoreInk, Rgb>,
    floor: colour('var(--core-floor)'),
    ring: colour('var(--core-ring)'),
    heart: colour('var(--core-heart)'),
    mark: colour('var(--muted)'),
    markFont: `${MARK_FONT_SIZE} ${getComputedStyle(element).getPropertyValue('--font-mono')}`,
    colour,
  };
}

/** The browser resolves the colour for us: set it, read the computed value back, restore. */
function resolveColour(element: HTMLElement, expression: string): string {
  const before = element.style.color;
  element.style.color = expression;
  const resolved = getComputedStyle(element).color;
  element.style.color = before;
  return resolved;
}

export function parseRgb(css: string): Rgb {
  const match = RGB_CHANNELS.exec(css);
  if (!match) return WHITE;
  return [Number(match[1]) / 255, Number(match[2]) / 255, Number(match[3]) / 255];
}

export const rgbCss = ([r, g, b]: Rgb, scale = 1): string =>
  `rgb(${Math.round(r * scale * 255)} ${Math.round(g * scale * 255)} ${Math.round(b * scale * 255)})`;
