import { FIELD_TINT_COUNT } from '../../../core/orrery/star-field';
import { channelReader } from '../../../shared/night-sky/night-sky';
import { ChartPalette } from './chart-painter';

/** The star map's colours from tokens.css, as the canvas can take them. */
export function readChartPalette(element: HTMLElement): ChartPalette {
  const channels = channelReader(element);
  const token = (name: string): string => channels(`var(--${name})`);
  const font = (name: string): string =>
    getComputedStyle(element).getPropertyValue(`--font-${name}`).trim();
  return {
    skyCentre: token('chart-sky-centre'),
    skyMid: token('chart-sky-mid'),
    skyEdge: token('chart-sky-edge'),
    ink: token('ink'),
    muted: token('muted'),
    quick: token('queue-quick'),
    core: token('orrery-world-light'),
    select: token('orrery-select'),
    vignette: token('orrery-vignette'),
    stars: Array.from({ length: FIELD_TINT_COUNT }, (_, index) =>
      token(`orrery-star-${index + 1}`),
    ),
    fontSans: font('sans'),
    fontMono: font('mono'),
    fontSerif: font('serif'),
    channels,
  };
}
