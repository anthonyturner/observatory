import { CardHover, HIDE_DELAY_MS, HoverTimers, SWITCH_DWELL_MS } from './card-hover';

/** Timers run by hand: `advance(ms)` fires every one that falls due. */
function manualTimers() {
  let now = 0;
  let nextId = 1;
  const pending = new Map<number, { at: number; run: () => void }>();
  const timers: HoverTimers = {
    set: (run, ms) => {
      const id = nextId++;
      pending.set(id, { at: now + ms, run });
      return id;
    },
    clear: (handle) => pending.delete(handle as number),
  };
  const advance = (ms: number): void => {
    now += ms;
    for (const [id, timer] of [...pending].sort((a, b) => a[1].at - b[1].at)) {
      if (timer.at <= now) {
        pending.delete(id);
        timer.run();
      }
    }
  };
  return { timers, advance };
}

function setup() {
  const { timers, advance } = manualTimers();
  let selected: string | null = null;
  let pinned = false;
  const hover = new CardHover(
    {
      selected: () => selected,
      select: (key) => (selected = key),
      isPinned: () => pinned,
    },
    timers,
  );
  return {
    hover,
    advance,
    shown: () => selected,
    pin: (key: string) => {
      selected = key;
      pinned = true;
    },
  };
}

describe('CardHover', () => {
  it('shows a hovered world at once when no card is up', () => {
    const { hover, shown } = setup();
    hover.over('a');
    expect(shown()).toBe('a');
  });

  it('lingers over empty sky long enough to reach the card, then hides', () => {
    const { hover, advance, shown } = setup();
    hover.over('a');
    hover.over(null);
    advance(HIDE_DELAY_MS - 1);
    expect(shown()).toBe('a');
    advance(1);
    expect(shown()).toBeNull();
  });

  it('keeps the card while the pointer is on it, and lets it go after', () => {
    const { hover, advance, shown } = setup();
    hover.over('a');
    hover.over(null);
    advance(HIDE_DELAY_MS / 2);
    hover.hold();
    advance(HIDE_DELAY_MS * 4);
    expect(shown()).toBe('a');
    hover.release();
    advance(HIDE_DELAY_MS);
    expect(shown()).toBeNull();
  });

  it('does not let a world passed on the way take the card over', () => {
    const { hover, advance, shown } = setup();
    hover.over('a');
    hover.over(null);
    hover.over('b');
    advance(SWITCH_DWELL_MS - 1);
    hover.over(null);
    advance(SWITCH_DWELL_MS);
    expect(shown()).toBe('a');
  });

  it('switches to a world the pointer rests on', () => {
    const { hover, advance, shown } = setup();
    hover.over('a');
    hover.over('b');
    advance(SWITCH_DWELL_MS / 2);
    // Called every frame: the dwell runs on, not restarting.
    hover.over('b');
    advance(SWITCH_DWELL_MS / 2);
    expect(shown()).toBe('b');
  });

  it('keeps the card when the pointer comes back to its own world', () => {
    const { hover, advance, shown } = setup();
    hover.over('a');
    hover.over(null);
    hover.over('a');
    advance(HIDE_DELAY_MS * 2);
    expect(shown()).toBe('a');
  });

  it('leaves a pinned card alone', () => {
    const { hover, advance, shown, pin } = setup();
    pin('a');
    hover.over('b');
    hover.over(null);
    hover.release();
    advance(HIDE_DELAY_MS * 2);
    expect(shown()).toBe('a');
  });

  it('lets a click cancel anything pending', () => {
    const { hover, advance, shown } = setup();
    hover.over('a');
    hover.over(null);
    hover.cancel();
    advance(HIDE_DELAY_MS * 2);
    expect(shown()).toBe('a');
  });
});
