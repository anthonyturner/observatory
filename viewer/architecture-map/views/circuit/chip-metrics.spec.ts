import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ArchitectureNode } from '../../../../server/architecture/architecture-types.ts';
import { SAMPLE_MAP } from '../../../../server/architecture/sample-map.ts';
import {
  CHIP_PADDING,
  CHIP_WIDTH,
  DAUGHTER_GAP,
  DAUGHTER_HEIGHT,
  MEMBERS_SHOWN,
  chipSize,
  packDaughters,
} from './chip-metrics.ts';

const node = (name: string, members = 0): ArchitectureNode => ({
  ...(SAMPLE_MAP.nodes[0] as ArchitectureNode),
  id: name,
  name,
  members: Array.from({ length: members }, (_, at) => ({
    name: `m${at}`,
    kind: 'method',
    visibility: 'public',
  })),
});

describe('packDaughters', () => {
  it('puts daughters side by side while they fit, and wraps to a new row when they do not', () => {
    const boxes = packDaughters([
      node('Row'),
      node('Cell'),
      node('AVeryLongDaughterChipName'),
      node('Other'),
    ]);
    assert.equal(boxes[0]?.y, 0);
    assert.equal(boxes[0]?.x, 0);
    assert.ok((boxes[1]?.x ?? 0) > 0);
    const wrapped = boxes.find((box) => box.y > 0);
    assert.equal(wrapped?.x, 0);
    assert.equal(wrapped?.y, DAUGHTER_HEIGHT + DAUGHTER_GAP);
  });

  it('keeps every daughter inside the chip, even one with a very long name', () => {
    const boxes = packDaughters([node('x'.repeat(120))]);
    assert.ok((boxes[0]?.width ?? 0) <= CHIP_WIDTH - 2 * CHIP_PADDING);
  });
});

describe('chipSize', () => {
  it('is taller for a chip with daughters than for one without', () => {
    const plain = chipSize(node('A'), [], 'classes').height;
    assert.ok(chipSize(node('A'), [node('B')], 'classes').height > plain);
  });

  it('lists members only at the members level, and no more than it can show', () => {
    const many = node('Many', MEMBERS_SHOWN + 5);
    assert.equal(chipSize(many, [], 'classes').membersShown, 0);
    const listed = chipSize(many, [], 'members');
    assert.equal(listed.membersShown, MEMBERS_SHOWN);
    assert.equal(listed.membersHidden, 5);
    assert.ok(listed.height > chipSize(many, [], 'classes').height);
  });

  it('starts the member list below the daughters', () => {
    const withDaughters = chipSize(node('A', 2), [node('B')], 'members');
    const without = chipSize(node('A', 2), [], 'members');
    assert.ok(withDaughters.membersTop > without.membersTop);
  });
});
