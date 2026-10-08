import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SAMPLE_MAP } from '../../../server/architecture/sample-map.ts';
import { indexMap } from './map-index.ts';
import { createMapStore } from './map-store.ts';
import {
  CLASS_LEVEL_NODE_LIMIT,
  disclosureOf,
  initialState,
  isCollapsed,
  nodeSelection,
  select,
  setLevel,
  toggleArea,
  type MapState,
} from './map-state.ts';

const index = indexMap(SAMPLE_MAP);
const QUEUE = 'browser:features/queue';
const FEED = 'browser:core/feed';
const ROW = 'src/app/features/queue/queue-row.ts#QueueRow';
const BASE_FEED = 'src/app/core/feed/base-feed.ts#BaseFeed';

const atLevel = (level: MapState['level']): MapState =>
  setLevel(initialState(index, 'circuit'), index, level);

describe('zoom and collapse', () => {
  it('opens every area at classes and members, and closes every one at areas', () => {
    assert.equal(isCollapsed(atLevel('areas'), QUEUE), true);
    assert.equal(isCollapsed(atLevel('classes'), QUEUE), false);
    assert.equal(isCollapsed(atLevel('members'), QUEUE), false);
  });

  it('lets one area be opened or closed against its level, and back', () => {
    const opened = toggleArea(atLevel('areas'), QUEUE);
    assert.equal(isCollapsed(opened, QUEUE), false);
    assert.equal(isCollapsed(opened, FEED), true);
    assert.equal(isCollapsed(toggleArea(opened, QUEUE), QUEUE), true);

    const closed = toggleArea(atLevel('classes'), QUEUE);
    assert.equal(isCollapsed(closed, QUEUE), true);
  });

  it('forgets hand-opened areas when the level changes', () => {
    const opened = toggleArea(atLevel('areas'), QUEUE);
    assert.equal(isCollapsed(setLevel(opened, index, 'classes'), QUEUE), false);
    assert.equal(isCollapsed(setLevel(opened, index, 'classes'), FEED), false);
    assert.equal(setLevel(opened, index, 'classes').flipped.size, 0);
  });

  it('starts at areas for a map too large to lay out whole', () => {
    assert.equal(initialState(index, 'circuit').level, 'classes');
    const crowd = {
      ...SAMPLE_MAP,
      nodes: Array(CLASS_LEVEL_NODE_LIMIT + 1).fill(SAMPLE_MAP.nodes[0]),
    };
    assert.equal(initialState(indexMap(crowd), 'circuit').level, 'areas');
  });

  it('changes the disclosure key only when a view would lay out again', () => {
    const state = atLevel('classes');
    assert.equal(disclosureOf(state), disclosureOf({ ...state, marks: false }));
    assert.equal(disclosureOf(state), disclosureOf(select(state, index, nodeSelection(ROW))));
    assert.notEqual(disclosureOf(state), disclosureOf(toggleArea(state, QUEUE)));
    assert.notEqual(disclosureOf(state), disclosureOf(atLevel('members')));
  });
});

describe('select', () => {
  it('opens the area that draws the chosen node, so the pick is never out of sight', () => {
    const picked = select(atLevel('areas'), index, nodeSelection(ROW));
    assert.equal(isCollapsed(picked, QUEUE), false);
    assert.equal(isCollapsed(picked, FEED), true);
  });

  it('opens the area of a chosen child by the area that draws it, and an area itself', () => {
    const area = select(atLevel('areas'), index, { kind: 'area', id: FEED });
    assert.equal(isCollapsed(area, FEED), false);
    const runtime = select(atLevel('areas'), index, { kind: 'runtime', id: 'browser' });
    assert.equal(isCollapsed(runtime, FEED), true);
  });

  it('keeps the selection open when the level goes back to areas', () => {
    const picked = select(atLevel('classes'), index, nodeSelection(BASE_FEED));
    const closed = setLevel(picked, index, 'areas');
    assert.equal(isCollapsed(closed, FEED), false);
    assert.equal(isCollapsed(closed, QUEUE), true);
  });

  it('returns the same state for the same pick, and clears with null', () => {
    const picked = select(atLevel('classes'), index, nodeSelection(ROW));
    assert.equal(select(picked, index, nodeSelection(ROW)), picked);
    assert.equal(select(picked, index, null).selection, null);
  });
});

describe('createMapStore', () => {
  it('tells listeners the new and the previous state, once per real change', () => {
    const store = createMapStore(index, initialState(index, 'circuit'));
    const seen: [string | undefined, string | undefined][] = [];
    const stop = store.subscribe((now, before) =>
      seen.push([now.selection?.id, before.selection?.id]),
    );

    store.select(nodeSelection(ROW));
    store.select(nodeSelection(ROW));
    store.select(null);
    stop();
    store.select(nodeSelection(ROW));

    assert.deepEqual(seen, [
      [ROW, undefined],
      [undefined, ROW],
    ]);
  });

  it('changes the tab, the marks and the level through one state', () => {
    const store = createMapStore(index, initialState(index, 'circuit'));
    store.setView('star');
    store.toggleMarks();
    store.setLevel('members');
    assert.deepEqual(
      [store.state().view, store.state().marks, store.state().level],
      ['star', false, 'members'],
    );
  });
});
