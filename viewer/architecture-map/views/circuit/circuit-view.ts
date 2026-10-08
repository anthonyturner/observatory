import { NODE_KINDS } from '../../../../server/architecture/architecture-types.ts';
import { NODE_KIND_LOOK } from '../../look.ts';
import { disclosureOf, nodeSelection, type MapState } from '../../model/map-state.ts';
import { scopeOf } from '../../model/scope.ts';
import { el } from '../../shell/dom.ts';
import type { LegendGroup, MapView, ViewContext, ViewHandle } from '../view.ts';
import { createCamera, ZOOM_IN, ZOOM_OUT } from './board-camera.ts';
import { drawBoard, type BoardDrawing } from './board-drawing.ts';
import { layoutBoard } from './board-layout.ts';
import { buildBoard } from './board-model.ts';
import './circuit.css';
import { createElkRunner } from './elk-runner.ts';

const LEGEND: readonly LegendGroup[] = [
  {
    title: 'Chips',
    entries: NODE_KINDS.map((kind) => ({
      label: `${NODE_KIND_LOOK[kind].badge} ${NODE_KIND_LOOK[kind].label}`,
      colour: NODE_KIND_LOOK[kind].colour,
      swatch: 'box',
    })),
  },
  {
    title: 'Board',
    entries: [
      { label: 'rig: a runtime', colour: '#6fe3ff', swatch: 'box' },
      { label: 'bay: an area (a folder)', colour: '#8fb3d9', swatch: 'dashed-box' },
      { label: 'daughter chip: rendered inside its parent', colour: '#c9b8ff', swatch: 'box' },
    ],
  },
];

const HINT = 'drag to pan · scroll to zoom · + - 0 · arrows pan · click a chip';

const secondsText = (milliseconds: number): string =>
  milliseconds < 1000 ? `${Math.round(milliseconds)} ms` : `${(milliseconds / 1000).toFixed(1)} s`;

function mount(host: HTMLElement, { index, store, motion }: ViewContext): ViewHandle {
  const runner = createElkRunner();
  const status = el('p', { class: 'board__status', attrs: { role: 'status' } });
  const frame = el('div', {
    class: 'board',
    attrs: {
      tabindex: 0,
      role: 'group',
      'aria-label':
        'Circuit board of the whole app. Drag to pan, scroll or press plus and minus to zoom, 0 to fit, arrow keys to pan. Tab moves between chips.',
    },
  });
  const controls = el(
    'div',
    { class: 'board__controls', attrs: { role: 'group', 'aria-label': 'Board zoom' } },
    el('button', {
      text: '+',
      attrs: { type: 'button', 'aria-label': 'Zoom in' },
      on: { click: () => camera.zoomBy(ZOOM_IN) },
    }),
    el('button', {
      text: '-',
      attrs: { type: 'button', 'aria-label': 'Zoom out' },
      on: { click: () => camera.zoomBy(ZOOM_OUT) },
    }),
    el('button', {
      text: 'Fit',
      attrs: { type: 'button', 'aria-label': 'Fit the whole board' },
      on: { click: () => camera.fit() },
    }),
  );
  host.append(frame, controls, status);
  const camera = createCamera(frame);

  let drawing: BoardDrawing | null = null;
  let active = false;
  let stale = true;
  let generation = 0;
  let toggledArea: string | null = null;

  const paint = (state: MapState): void => {
    drawing?.paint({
      scope: scopeOf(index, state.selection),
      selection: state.selection,
      marks: state.marks,
      reducedMotion: motion.reduced,
    });
  };

  const revealSelection = (state: MapState): void => {
    const { selection } = state;
    const box =
      selection?.kind === 'node'
        ? drawing?.boxFor(selection.id)
        : selection?.kind === 'area'
          ? drawing?.boxForArea(selection.id)
          : undefined;
    if (box) camera.reveal(box);
  };

  async function lay(placement: 'fit' | 'keep'): Promise<void> {
    const state = store.state();
    const board = buildBoard(index, state);
    const mine = ++generation;
    stale = false;
    const classes = board.anchorOf.size;
    status.textContent = `Laying out ${classes} classes…`;
    frame.setAttribute('aria-busy', 'true');
    const started = performance.now();
    try {
      const layout = await layoutBoard(board, runner);
      if (mine !== generation) return;
      drawing = drawBoard(board, layout);
      camera.show(drawing.element, layout, placement);
      frame.dataset['layoutMs'] = String(Math.round(performance.now() - started));
      status.textContent = `${classes} classes · laid out in ${secondsText(performance.now() - started)}`;
      paint(store.state());
      const opened = toggledArea === null ? undefined : drawing.boxForArea(toggledArea);
      toggledArea = null;
      if (opened) camera.reveal(opened);
      else revealSelection(store.state());
    } catch (error) {
      if (mine !== generation) return;
      status.textContent = `The board could not be laid out: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      if (mine === generation) frame.removeAttribute('aria-busy');
    }
  }

  const relayout = (placement: 'fit' | 'keep'): void => {
    lay(placement).catch((error: unknown) => console.error(error));
  };

  const stopStore = store.subscribe((state, previous) => {
    if (disclosureOf(state) !== disclosureOf(previous)) {
      stale = true;
      if (active) relayout(state.level === previous.level ? 'keep' : 'fit');
      return;
    }
    if (!active) return;
    paint(state);
    if (state.selection !== previous.selection) revealSelection(state);
  });
  const stopMotion = motion.onChange(() => paint(store.state()));

  frame.addEventListener('click', (event) => {
    const target =
      event.target instanceof Element ? event.target.closest<HTMLElement>('[data-action]') : null;
    const id = target?.dataset['id'];
    if (!target || id === undefined) return;
    const action = target.dataset['action'];
    if (action === 'node') store.select(nodeSelection(id));
    else if (action === 'area') store.select({ kind: 'area', id });
    else if (action === 'runtime') store.select({ kind: 'runtime', id });
    else if (action === 'toggle') {
      toggledArea = id;
      store.toggleArea(id);
    }
  });

  frame.addEventListener('focusin', (event) => {
    const id = event.target instanceof HTMLElement ? event.target.dataset['id'] : undefined;
    const box = id === undefined ? undefined : (drawing?.boxFor(id) ?? drawing?.boxForArea(id));
    if (box) camera.reveal(box);
  });

  return {
    setActive(next) {
      active = next;
      if (!next) return;
      if (stale || !drawing) relayout('fit');
      else paint(store.state());
    },
    destroy() {
      generation++;
      stopStore();
      stopMotion();
      camera.destroy();
      host.replaceChildren();
    },
  };
}

export const circuitView: MapView = {
  id: 'circuit',
  label: 'Circuit',
  hint: HINT,
  legend: LEGEND,
  mount,
};
