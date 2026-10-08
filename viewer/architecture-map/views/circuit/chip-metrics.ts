import type { ArchitectureNode } from '../../../../server/architecture/architecture-types.ts';
import type { ZoomLevel } from '../../model/map-state.ts';

/**
 * Every size on a chip, worked out here rather than measured from the page, so the
 * layout can be computed before anything is drawn and a chip can never overflow its box.
 */
export const CHIP_WIDTH = 248;
export const CHIP_PADDING = 10;
const CHIP_HEADER_HEIGHT = 20;
const CHIP_NAME_HEIGHT = 26;
const CHIP_FILE_HEIGHT = 16;
const CHIP_PINS_HEIGHT = 30;
export const DAUGHTER_HEIGHT = 20;
export const DAUGHTER_GAP = 6;
const MEMBER_HEIGHT = 15;
const MEMBER_BLOCK_GAP = 8;

/** A chip lists at most this many members; the rest are counted, not drawn. */
export const MEMBERS_SHOWN = 10;

const DAUGHTER_CHAR_WIDTH = 6.6;
const DAUGHTER_PADDING = 16;
const DAUGHTER_MIN_WIDTH = 40;

export interface DaughterBox {
  readonly node: ArchitectureNode;
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

/** The inside width a chip offers its daughters. */
const DAUGHTER_ROW_WIDTH = CHIP_WIDTH - 2 * CHIP_PADDING;

/** Lays daughter chips out in rows across the chip, wrapping where a row is full. */
export function packDaughters(daughters: readonly ArchitectureNode[]): DaughterBox[] {
  const boxes: DaughterBox[] = [];
  let x = 0;
  let y = 0;
  for (const node of daughters) {
    const wanted = Math.ceil(node.name.length * DAUGHTER_CHAR_WIDTH) + DAUGHTER_PADDING;
    const width = Math.min(Math.max(wanted, DAUGHTER_MIN_WIDTH), DAUGHTER_ROW_WIDTH);
    if (x > 0 && x + width > DAUGHTER_ROW_WIDTH) {
      x = 0;
      y += DAUGHTER_HEIGHT + DAUGHTER_GAP;
    }
    boxes.push({ node, x, y, width });
    x += width + DAUGHTER_GAP;
  }
  return boxes;
}

export interface ChipSize {
  readonly width: number;
  readonly height: number;
  readonly daughters: readonly DaughterBox[];
  /** Where, from the top of the chip, the member list starts. */
  readonly membersTop: number;
  /** How many of the node's members are listed, and how many are left out. */
  readonly membersShown: number;
  readonly membersHidden: number;
}

/** Where, below the top of a chip, its daughters start. */
export const DAUGHTERS_TOP =
  CHIP_PADDING + CHIP_HEADER_HEIGHT + CHIP_NAME_HEIGHT + CHIP_FILE_HEIGHT + MEMBER_BLOCK_GAP;

export function chipSize(
  node: ArchitectureNode,
  daughters: readonly ArchitectureNode[],
  level: ZoomLevel,
): ChipSize {
  const packed = packDaughters(daughters);
  const last = packed.at(-1);
  const contentEnd = last
    ? DAUGHTERS_TOP + last.y + DAUGHTER_HEIGHT
    : DAUGHTERS_TOP - MEMBER_BLOCK_GAP;

  const listing = level === 'members' ? node.members.length : 0;
  const membersShown = Math.min(listing, MEMBERS_SHOWN);
  const membersHidden = listing - membersShown;
  const memberRows = membersShown + (membersHidden > 0 ? 1 : 0);
  const membersTop = contentEnd + MEMBER_BLOCK_GAP;
  const membersEnd = memberRows === 0 ? contentEnd : membersTop + memberRows * MEMBER_HEIGHT;

  return {
    width: CHIP_WIDTH,
    height: membersEnd + CHIP_PADDING + CHIP_PINS_HEIGHT,
    daughters: packed,
    membersTop,
    membersShown,
    membersHidden,
  };
}
