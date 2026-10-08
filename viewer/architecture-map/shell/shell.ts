import type { ArchitectureMap } from '../../../server/architecture/architecture-types.ts';
import { indexMap } from '../model/map-index.ts';
import { initialState } from '../model/map-state.ts';
import { createMapStore } from '../model/map-store.ts';
import type { MapView, MotionPreference, ViewHandle } from '../views/view.ts';
import { el } from './dom.ts';
import { createLegend } from './legend.ts';
import { createTopBar } from './top-bar.ts';
import { createUmlCard } from './uml-card.ts';

export interface ShellOptions {
  readonly map: ArchitectureMap;
  readonly views: readonly MapView[];
  readonly root: HTMLElement;
}

function motionPreference(): MotionPreference {
  const query = matchMedia('(prefers-reduced-motion: reduce)');
  return {
    get reduced() {
      return query.matches;
    },
    onChange(listener) {
      query.addEventListener('change', listener);
      return () => query.removeEventListener('change', listener);
    },
  };
}

const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

/**
 * Builds the page around the views: the bar, the card, the legend and the hint, all
 * driven by one store. A view is mounted the first time its tab opens.
 */
export function startShell({ map, views, root }: ShellOptions): void {
  const first = views[0];
  if (!first) throw new Error('The map viewer has no views.');
  const index = indexMap(map);
  const store = createMapStore(index, initialState(index, first.id));
  const context = { index, store, motion: motionPreference() };

  const bar = createTopBar(index, store, views);
  const card = createUmlCard(index, store);
  const hint = el('p', { class: 'hint' });
  const hosts = new Map(
    views.map((view) => [
      view.id,
      el('div', {
        class: 'view',
        attrs: { role: 'tabpanel', id: `view-${view.id}`, 'aria-labelledby': `tab-${view.id}` },
      }),
    ]),
  );
  const legends = new Map(views.map((view) => [view.id, createLegend(view.legend)]));
  const mounted = new Map<string, ViewHandle>();

  const mount = (view: MapView, host: HTMLElement): ViewHandle | undefined => {
    try {
      return view.mount(host, context);
    } catch (error) {
      console.error(error);
      host.replaceChildren(
        el('p', { class: 'error', text: `The ${view.label} view could not start.` }),
      );
      return undefined;
    }
  };

  const open = (viewId: string): void => {
    for (const view of views) {
      const host = hosts.get(view.id);
      if (!host) continue;
      const isOpen = view.id === viewId;
      host.hidden = !isOpen;
      const legend = legends.get(view.id);
      if (legend) legend.hidden = !isOpen;
      if (isOpen) hint.textContent = view.hint;
      if (isOpen && !mounted.has(view.id)) {
        const handle = mount(view, host);
        if (handle) mounted.set(view.id, handle);
      }
      mounted.get(view.id)?.setActive(isOpen);
    }
  };

  root.replaceChildren(
    el(
      'div',
      { class: 'app' },
      bar.element,
      el(
        'main',
        { class: 'stage' },
        el('div', { class: 'views' }, ...hosts.values(), ...legends.values(), hint),
        card.element,
      ),
    ),
  );

  store.subscribe((state, previous) => {
    if (state.view !== previous.view) open(state.view);
  });
  open(store.state().view);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      store.select(null);
      if (document.activeElement instanceof HTMLElement && isTyping(document.activeElement)) {
        document.activeElement.blur();
      }
    } else if (event.key === '/' && !isTyping(event.target)) {
      event.preventDefault();
      bar.search.focus();
    }
  });
}
