import { MARK_LOOK, RUNTIME_ICON } from '../../look.ts';
import { el, icon } from '../../shell/dom.ts';
import type { Box } from './board-layout.ts';
import type { BayModel, RigModel } from './board-model.ts';

const px = (value: number): string => `${value}px`;

const place = (box: Box): Record<string, string> => ({
  left: px(box.x),
  top: px(box.y),
  width: px(box.width),
  height: px(box.height),
});

const plural = (count: number, one: string, many = `${one}es`): string =>
  `${count} ${count === 1 ? one : many}`;

/** A machine or process: its icon, name, folder and a status light that goes red when it holds an import cycle. */
export function rigElement(rig: RigModel, box: Box): HTMLElement {
  const { runtime } = rig;
  const state = rig.cycles > 0 ? 'cycle' : 'ok';
  const status = state === 'cycle' ? plural(rig.cycles, 'cycle', 'cycles') : 'no cycles';
  return el(
    'section',
    { class: 'rig', attrs: { 'data-box': rig.id, 'data-kind': runtime.kind }, style: place(box) },
    el(
      'header',
      { class: 'rig__head' },
      el(
        'button',
        {
          class: 'rig__title',
          attrs: { type: 'button', 'data-action': 'runtime', 'data-id': runtime.id },
        },
        icon(RUNTIME_ICON[runtime.kind]),
        el(
          'span',
          { class: 'rig__text' },
          el('span', { class: 'rig__name', text: runtime.label }),
          el('span', {
            class: 'rig__spec',
            text: `${runtime.root === '' ? runtime.kind : runtime.root} · ${plural(rig.classes, 'class')}`,
          }),
        ),
      ),
      el(
        'span',
        { class: 'rig__status', attrs: { 'data-state': state } },
        el('i', { class: 'led' }),
        status,
      ),
    ),
  );
}

function bayStats(bay: BayModel, internalLinks: number): HTMLElement {
  const marks = [...bay.marked].map(([mark, count]) =>
    el('span', {
      class: 'mark',
      text: `${MARK_LOOK[mark].tag} ${count}`,
      attrs: { title: `${count} ${MARK_LOOK[mark].label}: ${MARK_LOOK[mark].meaning}` },
      style: { '--mark': MARK_LOOK[mark].colour },
    }),
  );
  return el(
    'div',
    { class: 'bay__stats' },
    el('span', { text: plural(bay.classes, 'class') }),
    internalLinks > 0
      ? el('span', { text: plural(internalLinks, 'link inside', 'links inside') })
      : null,
    ...marks,
  );
}

/** A feature area: a dashed bay holding its chips, or, closed, one box with counts. */
export function bayElement(bay: BayModel, box: Box, internalLinks: number): HTMLElement {
  const { area } = bay;
  const verb = bay.collapsed ? 'Open' : 'Close';
  return el(
    'section',
    {
      class: `bay${bay.collapsed ? ' bay--closed' : ''}`,
      attrs: { 'data-box': bay.id, 'data-area': area.id },
      style: place(box),
    },
    el(
      'header',
      { class: 'bay__head' },
      el(
        'button',
        {
          class: 'bay__title',
          attrs: { type: 'button', 'data-action': 'area', 'data-id': area.id, title: area.folder },
        },
        el('b', { text: area.label }),
        el('span', { text: area.folder }),
      ),
      el('button', {
        class: 'bay__toggle',
        text: bay.collapsed ? '+' : '-',
        attrs: {
          type: 'button',
          'data-action': 'toggle',
          'data-id': area.id,
          'aria-expanded': String(!bay.collapsed),
          'aria-label': `${verb} ${area.label}`,
          title: `${verb} ${area.label}`,
        },
      }),
    ),
    bay.collapsed ? bayStats(bay, internalLinks) : null,
  );
}
