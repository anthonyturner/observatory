import { breadcrumbs } from '../model/breadcrumbs.ts';
import type { MapIndex } from '../model/map-index.ts';
import { ZOOM_LEVELS, nodeSelection } from '../model/map-state.ts';
import type { MapStore } from '../model/map-store.ts';
import type { MapView } from '../views/view.ts';
import { el } from './dom.ts';
import { createSearchBox, type SearchBox } from './search-box.ts';

const LEVEL_LABEL = { areas: 'Areas', classes: 'Classes', members: 'Members' } as const;
const LEVEL_HELP = {
  areas: 'Show each area as one box',
  classes: 'Show the classes in each area',
  members: 'Show the members of each class',
} as const;

export interface TopBar {
  readonly element: HTMLElement;
  readonly search: SearchBox;
}

function tabs(views: readonly MapView[], store: MapStore): HTMLElement {
  const buttons = views.map((view) =>
    el('button', {
      class: 'btn',
      text: view.label,
      attrs: {
        type: 'button',
        role: 'tab',
        id: `tab-${view.id}`,
        'aria-controls': `view-${view.id}`,
      },
      on: { click: () => store.setView(view.id) },
    }),
  );
  const list = el(
    'div',
    { class: 'tabs segmented', attrs: { role: 'tablist', 'aria-label': 'View' } },
    ...buttons,
  );
  list.addEventListener('keydown', (event) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    const at = views.findIndex((view) => view.id === store.state().view);
    const next = views[(at + step + views.length) % views.length];
    if (next) store.setView(next.id);
    document.getElementById(`tab-${next?.id}`)?.focus();
  });
  const sync = (): void => {
    buttons.forEach((button, at) => {
      const open = views[at]?.id === store.state().view;
      button.setAttribute('aria-selected', String(open));
      button.tabIndex = open ? 0 : -1;
    });
  };
  store.subscribe(sync);
  sync();
  return list;
}

function levels(store: MapStore): HTMLElement {
  const buttons = ZOOM_LEVELS.map((level) =>
    el('button', {
      class: 'btn',
      text: LEVEL_LABEL[level],
      attrs: { type: 'button', title: LEVEL_HELP[level] },
      on: { click: () => store.setLevel(level) },
    }),
  );
  const sync = (): void =>
    buttons.forEach((button, at) =>
      button.setAttribute('aria-pressed', String(ZOOM_LEVELS[at] === store.state().level)),
    );
  store.subscribe(sync);
  sync();
  return el(
    'div',
    { class: 'segmented', attrs: { role: 'group', 'aria-label': 'Zoom level' } },
    ...buttons,
  );
}

function marksToggle(store: MapStore): HTMLElement {
  const button = el('button', {
    class: 'btn',
    text: 'Marks',
    attrs: { type: 'button', title: 'Show or hide hub, cycle, unused, boundary and hot marks' },
    on: { click: () => store.toggleMarks() },
  });
  const sync = (): void => button.setAttribute('aria-pressed', String(store.state().marks));
  store.subscribe(sync);
  sync();
  return button;
}

function crumbs(index: MapIndex, store: MapStore): HTMLElement {
  const nav = el('nav', { class: 'crumbs', attrs: { 'aria-label': 'Where the selection sits' } });
  const draw = (): void => {
    const path = breadcrumbs(index, store.state().selection);
    const items = [
      el(
        'li',
        {},
        el('button', {
          text: index.map.project,
          attrs: { type: 'button' },
          on: { click: () => store.select(null) },
        }),
      ),
      ...path.map(({ label, selection }, at) => {
        const last = at === path.length - 1;
        const inner = el('button', {
          text: label,
          attrs: { type: 'button', 'aria-current': last ? 'location' : undefined },
          on: { click: () => store.select(selection) },
        });
        return el('li', {}, inner);
      }),
    ];
    nav.replaceChildren(el('ol', {}, ...items));
  };
  store.subscribe((state, previous) => {
    if (state.selection !== previous.selection) draw();
  });
  draw();
  return nav;
}

/** The bar across the top: tabs, breadcrumbs, search, zoom level and the marks switch. */
export function createTopBar(index: MapIndex, store: MapStore, views: readonly MapView[]): TopBar {
  const search = createSearchBox(index, index.map.nodes, (id) => store.select(nodeSelection(id)));
  const element = el(
    'header',
    { class: 'bar' },
    el('div', { class: 'brand' }, 'Architecture map', el('small', { text: index.map.project })),
    tabs(views, store),
    crumbs(index, store),
    search.element,
    levels(store),
    marksToggle(store),
  );
  return { element, search };
}
