import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApiHandler } from '../http/api-handler.ts';
import { principleOfDay, principlesOn } from './principle-of-day.ts';
import { PRINCIPLES_PATH, withPrincipleRoutes } from './principle-routes.ts';
import { PRINCIPLES } from './principles.ts';

const NOON_8_OCT = new Date(2026, 9, 8, 12);

describe('principlesOn', () => {
  it('keeps one principle all day, and moves to the next one the day after', () => {
    const today = principlesOn('2026-10-08', NOON_8_OCT).today;

    assert.equal(principlesOn('2026-10-08', new Date(2030, 0, 1)).today, today);
    assert.equal(principlesOn('2026-10-09', NOON_8_OCT).today, (today + 1) % PRINCIPLES.length);
  });

  it('comes round to every principle in turn', () => {
    const seen = new Set<number>();
    for (let day = 1; day <= PRINCIPLES.length; day++) {
      seen.add(principlesOn(`2027-01-${String(day).padStart(2, '0')}`, NOON_8_OCT).today);
    }

    assert.equal(seen.size, PRINCIPLES.length);
  });

  it('reads a missing or unreal day as today where it runs', () => {
    const today = principlesOn('2026-10-08', NOON_8_OCT).today;

    for (const day of [null, '', 'tomorrow', '2026-02-31', '2026-10-8']) {
      assert.equal(principlesOn(day, NOON_8_OCT).today, today, String(day));
    }
  });

  it('carries the whole deck, so a page can step through it', () => {
    assert.equal(principlesOn('2026-10-08', NOON_8_OCT).principles, PRINCIPLES);
  });
});

describe('principleOfDay', () => {
  it('is the principle the deck names for the local day', () => {
    const { principles, today } = principlesOn('2026-10-08', NOON_8_OCT);

    assert.equal(principleOfDay(NOON_8_OCT), principles[today]);
  });
});

describe('PRINCIPLES', () => {
  it('has a unique id and every field written for each principle', () => {
    assert.equal(new Set(PRINCIPLES.map((each) => each.id)).size, PRINCIPLES.length);
    for (const each of PRINCIPLES) {
      assert.ok(each.title && each.idea && each.question.endsWith('?'), each.id);
    }
  });
});

describe('withPrincipleRoutes', () => {
  it('answers with the deck and the principle for the day the page asks about', async () => {
    const handle = createApiHandler(withPrincipleRoutes({ get: {}, post: {} }, () => NOON_8_OCT));

    const response = await handle(new Request(`https://x${PRINCIPLES_PATH}?day=2026-10-09`));

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), principlesOn('2026-10-09', NOON_8_OCT));
  });
});
