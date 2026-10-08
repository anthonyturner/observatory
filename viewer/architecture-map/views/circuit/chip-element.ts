import type { ArchitectureNode } from '../../../../server/architecture/architecture-types.ts';
import { MARK_LOOK, NODE_KIND_LOOK, VISIBILITY_SIGN } from '../../look.ts';
import { el } from '../../shell/dom.ts';
import type { Box } from './board-layout.ts';
import type { ChipModel } from './board-model.ts';
import { CHIP_PADDING, DAUGHTERS_TOP, type ChipSize, type DaughterBox } from './chip-metrics.ts';

export interface DaughterDrawing {
  readonly element: HTMLElement;
  readonly nodeId: string;
}

export interface ChipDrawing {
  readonly element: HTMLElement;
  readonly nodeId: string;
  /** The node the chip stands for, then each daughter drawn inside it. */
  readonly nodeIds: readonly string[];
  readonly daughters: readonly DaughterDrawing[];
}

const px = (value: number): string => `${value}px`;

function markTags(node: ArchitectureNode): HTMLElement[] {
  return node.marks.map((mark) => {
    const look = MARK_LOOK[mark];
    return el('span', {
      class: 'mark',
      text: look.tag,
      attrs: { title: `${look.label}: ${look.meaning}` },
      style: { '--mark': look.colour },
    });
  });
}

function chipLabel(node: ArchitectureNode): string {
  const marks = node.marks.map((mark) => MARK_LOOK[mark].label);
  return [
    node.name,
    NODE_KIND_LOOK[node.kind].label,
    `${node.metrics.fanIn} in`,
    `${node.metrics.fanOut} out`,
    ...marks,
  ].join(', ');
}

function pin(label: string, value: number | string): HTMLElement {
  return el('span', { class: 'pin' }, `${label} `, el('b', { text: String(value) }));
}

function memberList(node: ArchitectureNode, size: ChipSize): HTMLElement {
  const rows = node.members
    .slice(0, size.membersShown)
    .map((member) =>
      el(
        'li',
        { attrs: { title: `${member.visibility} ${member.kind}` } },
        el('span', { class: 'member__sign', text: VISIBILITY_SIGN[member.visibility] }),
        member.name,
        el('span', { class: 'member__kind', text: member.kind }),
      ),
    );
  if (size.membersHidden > 0) {
    rows.push(el('li', { class: 'member__more', text: `+${size.membersHidden} more` }));
  }
  return el('ul', { class: 'chip__members', style: { top: px(size.membersTop) } }, ...rows);
}

function daughterElement(at: DaughterBox): DaughterDrawing {
  const { node } = at;
  const look = NODE_KIND_LOOK[node.kind];
  const element = el(
    'button',
    {
      class: 'daughter',
      attrs: {
        type: 'button',
        'data-action': 'node',
        'data-id': node.id,
        'aria-label': chipLabel(node),
      },
      style: {
        left: px(CHIP_PADDING + at.x),
        top: px(DAUGHTERS_TOP + at.y),
        width: px(at.width),
        '--kind': look.colour,
      },
    },
    el('span', { class: 'daughter__name', text: node.name }),
    ...markTags(node),
  );
  return { element, nodeId: node.id };
}

/** One chip: kind badge, name, file, its daughters, and, when zoomed in, its members. */
export function chipElement(chip: ChipModel, box: Box): ChipDrawing {
  const { node, size } = chip;
  const look = NODE_KIND_LOOK[node.kind];
  const daughters = size.daughters.map(daughterElement);
  const provided = node.providedIn === null ? '' : ` · ${node.providedIn}`;
  const element = el(
    'div',
    {
      class: 'chip',
      attrs: {
        'data-action': 'node',
        'data-id': node.id,
        'data-kind': node.kind,
        'data-marks': node.marks.join(' '),
      },
      style: {
        left: px(box.x),
        top: px(box.y),
        width: px(box.width),
        height: px(box.height),
        '--kind': look.colour,
      },
    },
    el(
      'button',
      {
        class: 'chip__main',
        attrs: {
          type: 'button',
          'data-action': 'node',
          'data-id': node.id,
          'aria-label': chipLabel(node),
        },
      },
      el(
        'span',
        { class: 'chip__top' },
        el('span', { class: 'badge', text: look.badge }),
        el('span', { class: 'chip__kind', text: `${look.label}${provided}` }),
        ...markTags(node),
        el('span', { class: 'led' }),
      ),
      el('span', { class: 'chip__name', text: node.name, attrs: { title: node.name } }),
      el('span', {
        class: 'chip__file',
        text: node.file === '' ? 'outside the project' : node.file,
        attrs: { title: node.file },
      }),
    ),
    ...daughters.map(({ element: each }) => each),
    size.membersShown > 0 ? memberList(node, size) : null,
    el(
      'div',
      { class: 'chip__pins' },
      pin('members', node.members.length),
      pin('in', node.metrics.fanIn),
      pin('out', node.metrics.fanOut),
      node.loc > 0 ? pin('loc', node.loc) : null,
    ),
  );
  return {
    element,
    nodeId: node.id,
    nodeIds: [node.id, ...daughters.map(({ nodeId }) => nodeId)],
    daughters,
  };
}
