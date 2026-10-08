import type {
  ArchitectureEdge,
  ArchitectureNode,
} from '../../../server/architecture/architecture-types.ts';
import { EDGE_KIND_LOOK, MARK_LOOK, NODE_KIND_LOOK, VISIBILITY_SIGN } from '../look.ts';
import { nodesOfArea, type MapIndex } from '../model/map-index.ts';
import { nodeSelection, type Selection } from '../model/map-state.ts';
import type { MapStore } from '../model/map-store.ts';
import { groupSummary } from '../model/scope.ts';
import { el } from './dom.ts';

/** A group's card lists at most this many of its nodes. */
const GROUP_NODES_SHOWN = 40;

type Child = Node | string | null;

const row = (key: string, ...value: Child[]): HTMLElement =>
  el('div', { class: 'card__row' }, el('span', { class: 'card__key', text: key }), ...value);

function marksOf(marks: readonly (keyof typeof MARK_LOOK)[]): HTMLElement | null {
  if (marks.length === 0) return null;
  return el(
    'div',
    { class: 'card__marks' },
    ...marks.map((mark) =>
      el('span', {
        class: 'mark',
        text: `${MARK_LOOK[mark].tag} ${MARK_LOOK[mark].meaning}`,
        style: { '--mark': MARK_LOOK[mark].colour },
      }),
    ),
  );
}

function nodeLink(
  store: MapStore,
  node: ArchitectureNode,
  arrow: string,
  edge?: ArchitectureEdge,
): HTMLElement {
  const colour = edge ? EDGE_KIND_LOOK[edge.kind].colour : 'var(--dim)';
  return el(
    'button',
    {
      class: 'card__link',
      attrs: { type: 'button', title: node.id },
      style: { '--c': colour },
      on: { click: () => store.select(nodeSelection(node.id)) },
    },
    el('span', { class: 'card__arrow', text: arrow }),
    edge ? el('span', { class: 'card__key', text: edge.kind }) : null,
    node.name,
    edge && edge.marks.length > 0
      ? el('span', {
          class: 'card__key',
          text: `(${edge.marks.map((m) => MARK_LOOK[m].label).join(', ')})`,
        })
      : null,
  );
}

function linksSection(
  index: MapIndex,
  store: MapStore,
  node: ArchitectureNode,
): HTMLElement | null {
  const byName = (a: ArchitectureNode, b: ArchitectureNode): number => a.name.localeCompare(b.name);
  const leaving = (index.edgesOut.get(node.id) ?? []).flatMap((edge) => {
    const other = index.nodes.get(edge.to);
    return other ? [{ edge, other }] : [];
  });
  const arriving = (index.edgesIn.get(node.id) ?? []).flatMap((edge) => {
    const other = index.nodes.get(edge.from);
    return other ? [{ edge, other }] : [];
  });
  const parent = node.parent === null ? undefined : index.nodes.get(node.parent);
  const children = [...(index.childrenOf.get(node.id) ?? [])].sort(byName);
  const lines = [
    ...leaving.map(({ edge, other }) => nodeLink(store, other, '→', edge)),
    ...arriving.map(({ edge, other }) => nodeLink(store, other, '←', edge)),
    ...(parent ? [row('rendered by'), nodeLink(store, parent, '↑')] : []),
    ...children.map((child) => nodeLink(store, child, '◦')),
  ];
  return lines.length === 0 ? null : el('section', { attrs: { 'aria-label': 'Links' } }, ...lines);
}

function churnText(index: MapIndex, node: ArchitectureNode): string {
  const { churnDays } = index.map;
  return churnDays === 0 ? 'unknown' : `${node.metrics.churn} commits in ${churnDays} days`;
}

function nodeCard(index: MapIndex, store: MapStore, node: ArchitectureNode): Child[] {
  const look = NODE_KIND_LOOK[node.kind];
  const facts = [
    row('file', node.file === '' ? 'outside the project' : node.file),
    node.endpoint ? row('endpoint', `${node.endpoint.method} ${node.endpoint.path}`) : null,
    node.providedIn ? row('providedIn', `'${node.providedIn}'`) : null,
    node.windows.length > 0 ? row('windows', node.windows.join(', ')) : null,
    row('loc', String(node.loc)),
    row('churn', churnText(index, node)),
    row('fan-in / fan-out', `${node.metrics.fanIn} / ${node.metrics.fanOut}`),
  ];
  return [
    el(
      'header',
      {},
      el('div', { class: 'card__stereotype', text: `«${look.label}»` }),
      el('h2', { text: node.name }),
    ),
    el('section', {}, ...facts, marksOf(node.marks)),
    node.members.length > 0
      ? el(
          'section',
          { attrs: { 'aria-label': 'Members' } },
          ...node.members.map((member) =>
            el(
              'div',
              { class: 'card__member', attrs: { title: `${member.visibility} ${member.kind}` } },
              el('span', { text: VISIBILITY_SIGN[member.visibility] }),
              el('span', { text: member.name }),
              el('span', { text: member.kind }),
            ),
          ),
        )
      : null,
    linksSection(index, store, node),
  ];
}

function groupCard(index: MapIndex, store: MapStore, selection: Selection): Child[] {
  const summary = groupSummary(index, selection);
  const isArea = selection.kind === 'area';
  const area = isArea ? index.areas.get(selection.id) : undefined;
  const runtime = isArea ? undefined : index.runtimes.get(selection.id);
  const title = area?.label ?? runtime?.label ?? selection.id;
  const where = area?.folder ?? runtime?.root ?? '';
  const children = isArea
    ? [...nodesOfArea(index, selection.id)].sort((a, b) => a.name.localeCompare(b.name))
    : [];
  const areas = isArea ? [] : (index.areasOfRuntime.get(selection.id) ?? []);
  return [
    el(
      'header',
      {},
      el('div', { class: 'card__stereotype', text: `«${selection.kind}»` }),
      el('h2', { text: title }),
    ),
    el(
      'section',
      {},
      where === '' ? null : row('folder', where),
      row('classes', String(summary.nodes)),
      ...[...summary.marked].map(([mark, count]) =>
        el(
          'div',
          { class: 'card__marks' },
          el('span', {
            class: 'mark',
            text: `${MARK_LOOK[mark].tag} ${count}`,
            style: { '--mark': MARK_LOOK[mark].colour },
          }),
          el('span', { class: 'card__key', text: MARK_LOOK[mark].meaning }),
        ),
      ),
    ),
    children.length > 0
      ? el(
          'section',
          { attrs: { 'aria-label': 'Classes' } },
          ...children.slice(0, GROUP_NODES_SHOWN).map((node) => nodeLink(store, node, '◦')),
          children.length > GROUP_NODES_SHOWN
            ? el('div', {
                class: 'card__empty',
                text: `+${children.length - GROUP_NODES_SHOWN} more`,
              })
            : null,
        )
      : null,
    areas.length > 0
      ? el(
          'section',
          { attrs: { 'aria-label': 'Areas' } },
          ...areas.map((each) =>
            el('button', {
              class: 'card__link',
              text: each.label,
              attrs: { type: 'button' },
              on: { click: () => store.select({ kind: 'area', id: each.id }) },
            }),
          ),
        )
      : null,
  ];
}

export interface UmlCard {
  readonly element: HTMLElement;
}

/** The hologram card for whatever is selected; clicking a link on it selects that node. */
export function createUmlCard(index: MapIndex, store: MapStore): UmlCard {
  const card = el('aside', { class: 'card', attrs: { 'aria-label': 'Details of the selection' } });
  card.hidden = true;

  const show = (selection: Selection | null): void => {
    const node = selection?.kind === 'node' ? index.nodes.get(selection.id) : undefined;
    const content =
      selection === null
        ? null
        : selection.kind === 'node'
          ? node && nodeCard(index, store, node)
          : groupCard(index, store, selection);
    card.hidden = !content;
    if (!content) return;
    card.replaceChildren(
      el('button', {
        class: 'card__close',
        text: '×',
        attrs: { type: 'button', 'aria-label': 'Close the details' },
        on: { click: () => store.select(null) },
      }),
      ...content.flatMap((child) => (child === null ? [] : [child])),
    );
    card.scrollTop = 0;
  };

  show(store.state().selection);
  store.subscribe((state, previous) => {
    if (state.selection !== previous.selection) show(state.selection);
  });
  return { element: card };
}
