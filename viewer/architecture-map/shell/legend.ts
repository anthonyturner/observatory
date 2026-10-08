import {
  EDGE_KINDS,
  FLOW_EDGE_KINDS,
  NODE_MARKS,
} from '../../../server/architecture/architecture-types.ts';
import { EDGE_KIND_LOOK, MARK_LOOK } from '../look.ts';
import type { LegendEntry, LegendGroup } from '../views/view.ts';
import { el } from './dom.ts';

function swatchFor(entry: LegendEntry): HTMLElement {
  return el('span', { class: `swatch swatch--${entry.swatch}`, style: { '--c': entry.colour } });
}

function group(title: string, items: readonly HTMLElement[]): HTMLElement {
  return el(
    'div',
    {},
    el('h3', { text: title }),
    el('ul', {}, ...items.map((item) => el('li', {}, item))),
  );
}

function entryItem(entry: LegendEntry): HTMLElement {
  return el('span', { class: 'legend__entry' }, swatchFor(entry), entry.label);
}

/** The edge kinds, thin for a code dependency and thick for a request that travels at run time. */
function edgeKindGroup(): HTMLElement {
  const lines = EDGE_KINDS.map((kind) => {
    const flow = FLOW_EDGE_KINDS.includes(kind);
    const look = EDGE_KIND_LOOK[kind];
    const style = flow ? 'swatch--flow' : kind === 'imports' ? 'swatch--dashed' : '';
    return el(
      'span',
      { class: 'legend__entry', attrs: { title: look.meaning } },
      el('span', { class: `swatch ${style}`, style: { '--c': look.colour } }),
      `${look.label}${flow ? ' (flow)' : ''}`,
    );
  });
  return group('Links: thick = flow at run time', lines);
}

function markGroup(): HTMLElement {
  return group(
    'Marks',
    NODE_MARKS.map((mark) =>
      el(
        'span',
        { class: 'legend__entry' },
        el('span', {
          class: 'mark',
          text: MARK_LOOK[mark].tag,
          style: { '--mark': MARK_LOOK[mark].colour },
        }),
        MARK_LOOK[mark].meaning,
      ),
    ),
  );
}

/** What the colours, lines and marks mean: the view's own shapes, then the links and marks every view shares. */
export function createLegend(view: readonly LegendGroup[]): HTMLElement {
  return el(
    'details',
    { class: 'legend' },
    el('summary', { text: 'Legend' }),
    el(
      'div',
      { class: 'legend__body' },
      ...view.map(({ title, entries }) => group(title, entries.map(entryItem))),
      edgeKindGroup(),
      markGroup(),
    ),
  );
}
