import { MapEntry, Neighbour, Neighbourhood, memberUse } from './architecture-graph';
import { ArchitectureArea } from './architecture.types';

export type UmlRole = 'dependent' | 'centre' | 'dependency';

export interface UmlLine {
  readonly text: string;
  readonly y: number;
}

/** One class box: a stereotype, a name, and the members read across its injection. */
export interface UmlBox {
  readonly entry: MapEntry;
  readonly role: UmlRole;
  readonly stereotype: string;
  /** Cut to fit the box; the full name is on the entry. */
  readonly title: string;
  readonly x: number;
  readonly y: number;
  readonly height: number;
  readonly lines: readonly UmlLine[];
}

export interface UmlCaption {
  readonly text: string;
  readonly x: number;
}

export interface UmlDiagram {
  readonly boxes: readonly UmlBox[];
  /** One path per injection, drawn from the class that injects to the class injected. */
  readonly links: readonly string[];
  readonly captions: readonly UmlCaption[];
  readonly width: number;
  readonly height: number;
}

export const BOX_WIDTH = 300;
export const HEADER_HEIGHT = 48;
/** Column captions sit above the boxes. */
export const TOP = 30;
const COLUMN_GAP = 130;
const BOX_GAP = 14;
const LINE_HEIGHT = 17;
const BOX_PADDING = 10;
const MAX_NEIGHBOUR_LINES = 6;
const MAX_CENTRE_LINES = 16;
const MAX_TITLE_CHARS = 38;
const ELLIPSIS = '…';
const COLUMN_X: Readonly<Record<UmlRole, number>> = {
  dependent: 0,
  centre: BOX_WIDTH + COLUMN_GAP,
  dependency: (BOX_WIDTH + COLUMN_GAP) * 2,
};

/** What goes in a box before it has a place. */
interface Draft {
  readonly entry: MapEntry;
  readonly role: UmlRole;
  readonly members: readonly string[];
  readonly limit: number;
}

const titleOf = (name: string): string =>
  name.length > MAX_TITLE_CHARS ? `${name.slice(0, MAX_TITLE_CHARS - 1)}${ELLIPSIS}` : name;

/** At most `limit` lines; when members are cut, the last line says how many more there are. */
function linesOf(members: readonly string[], limit: number): UmlLine[] {
  const cut = members.length > limit;
  const texts = cut
    ? [...members.slice(0, limit - 1), `${ELLIPSIS} ${members.length - limit + 1} more`]
    : members;
  return texts.map((text, index) => ({
    text,
    y: HEADER_HEIGHT + BOX_PADDING + LINE_HEIGHT * index + LINE_HEIGHT / 2,
  }));
}

const heightOf = (lines: number): number =>
  HEADER_HEIGHT + (lines ? BOX_PADDING * 2 + LINE_HEIGHT * lines : 0);

function boxAt(draft: Draft, y: number, areaLabel: string): UmlBox {
  const lines = linesOf(draft.members, draft.limit);
  const { entry, role } = draft;
  return {
    entry,
    role,
    stereotype: `«${entry.node.kind}» ${areaLabel}`,
    title: titleOf(entry.node.name),
    x: COLUMN_X[role],
    y,
    height: heightOf(lines.length),
    lines,
  };
}

/** One column of boxes, top to bottom. */
function stack(drafts: readonly Draft[], labels: ReadonlyMap<string, string>): UmlBox[] {
  const boxes: UmlBox[] = [];
  let y = TOP;
  for (const draft of drafts) {
    const box = boxAt(draft, y, labels.get(draft.entry.node.area) ?? draft.entry.node.area);
    boxes.push(box);
    y += box.height + BOX_GAP;
  }
  return boxes;
}

const neighbourDrafts = (neighbours: readonly Neighbour[], role: UmlRole): Draft[] =>
  neighbours.map(({ entry, members }) => ({ entry, role, members, limit: MAX_NEIGHBOUR_LINES }));

function centreDraft(neighbourhood: Neighbourhood): Draft {
  const members = memberUse(neighbourhood.dependents).map(({ member, readers }) =>
    readers > 1 ? `${member}  ×${readers}` : member,
  );
  return { entry: neighbourhood.centre, role: 'centre', members, limit: MAX_CENTRE_LINES };
}

/** A curve from the right edge of `from` to the left edge of `to`, at each box's header. */
function linkBetween(from: UmlBox, to: UmlBox): string {
  const [x1, y1] = [from.x + BOX_WIDTH, from.y + HEADER_HEIGHT / 2];
  const [x2, y2] = [to.x, to.y + HEADER_HEIGHT / 2];
  const bend = COLUMN_GAP / 2;
  return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
}

function captionsOf(neighbourhood: Neighbourhood): UmlCaption[] {
  return [
    { text: `Injected by ${neighbourhood.dependents.length}`, x: COLUMN_X.dependent },
    { text: 'Centre', x: COLUMN_X.centre },
    { text: `Injects ${neighbourhood.dependencies.length}`, x: COLUMN_X.dependency },
  ];
}

const bottomOf = (boxes: readonly UmlBox[]): number =>
  Math.max(TOP, ...boxes.map((box) => box.y + box.height));

/** The centre between the classes that inject it (left) and the classes it injects (right). */
export function umlDiagram(
  neighbourhood: Neighbourhood,
  areas: readonly ArchitectureArea[],
): UmlDiagram {
  const labels = new Map(areas.map(({ id, label }) => [id, label]));
  const dependents = stack(neighbourDrafts(neighbourhood.dependents, 'dependent'), labels);
  const [centre] = stack([centreDraft(neighbourhood)], labels);
  const dependencies = stack(neighbourDrafts(neighbourhood.dependencies, 'dependency'), labels);
  const boxes = centre ? [...dependents, centre, ...dependencies] : [];
  const links = centre
    ? [
        ...dependents.map((box) => linkBetween(box, centre)),
        ...dependencies.map((box) => linkBetween(centre, box)),
      ]
    : [];
  return {
    boxes,
    links,
    captions: captionsOf(neighbourhood),
    width: COLUMN_X.dependency + BOX_WIDTH,
    height: bottomOf(boxes) + BOX_GAP,
  };
}
