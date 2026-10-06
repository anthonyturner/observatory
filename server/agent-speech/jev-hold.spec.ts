import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { HoldMarker } from './hold-marker.ts';
import { HOLD_LIFETIME_MS, MAX_HOLD_MS, jevHold } from './jev-hold.ts';

/** A marker that remembers what it was last told, and a clock the test turns. */
function setUp() {
  let marker: string | null = null;
  let clock = 1_000_000;
  const fake: HoldMarker = {
    write: (expiresAt, token) => {
      marker = `${expiresAt}|${token}`;
    },
    clear: () => {
      marker = null;
    },
  };
  const hold = jevHold({ marker: fake, now: () => clock });
  return {
    hold,
    marker: () => marker,
    wait: (ms: number) => {
      clock += ms;
    },
  };
}

describe('jevHold', () => {
  it('keeps the marker 6 s ahead of each renewal', () => {
    const { hold, marker, wait } = setUp();

    hold.renew('a');
    assert.equal(marker(), `${1_000_000 + HOLD_LIFETIME_MS}|a`);
    wait(2_000);
    hold.renew('a');
    assert.equal(marker(), `${1_002_000 + HOLD_LIFETIME_MS}|a`);
  });

  it('removes the marker on release', () => {
    const { hold, marker } = setUp();
    hold.renew('a');

    hold.release('a');

    assert.equal(marker(), null);
  });

  it('keeps the marker until every tab has released', () => {
    const { hold, marker, wait } = setUp();
    hold.renew('a');
    wait(500);
    hold.renew('b');

    hold.release('a');
    assert.equal(marker(), `${1_000_500 + HOLD_LIFETIME_MS}|b`);
    hold.release('b');
    assert.equal(marker(), null);
  });

  it('does not wait on a tab that went quiet without releasing', () => {
    const { hold, marker, wait } = setUp();
    hold.renew('dead');
    wait(1_000);
    hold.renew('b');
    wait(HOLD_LIFETIME_MS);

    hold.release('b');

    assert.equal(marker(), null);
  });

  it('ignores a renewal that lands after its release', () => {
    const { hold, marker } = setUp();
    hold.renew('a');
    hold.release('a');

    hold.renew('a');

    assert.equal(marker(), null);
  });

  it('never renews one hold past 5 minutes', () => {
    const { hold, marker, wait } = setUp();
    hold.renew('stuck');
    for (let held = 0; held < MAX_HOLD_MS; held += 2_000) {
      wait(2_000);
      hold.renew('stuck');
    }
    const last = marker();

    wait(2_000);
    hold.renew('stuck');
    assert.equal(marker(), last);
    wait(HOLD_LIFETIME_MS);
    hold.renew('stuck');
    assert.equal(marker(), null);
  });

  it('keeps refusing a stuck hold after it would have been forgotten', () => {
    const { hold, marker, wait } = setUp();
    hold.renew('stuck');
    for (let held = 0; held < MAX_HOLD_MS + 120_000; held += 2_000) {
      wait(2_000);
      hold.renew('stuck');
    }

    assert.equal(marker(), null);
  });
});
