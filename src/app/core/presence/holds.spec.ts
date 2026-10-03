import { holds } from './holds';

describe('holds', () => {
  it('is held while any holder has not let go, and letting go twice counts once', () => {
    const presence = holds();
    expect(presence.isHeld()).toBe(false);
    const first = presence.hold();
    const second = presence.hold();
    first();
    first();
    expect(presence.isHeld()).toBe(true);
    second();
    expect(presence.isHeld()).toBe(false);
  });
});
