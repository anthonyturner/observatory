import { Signal, computed, signal } from '@angular/core';

/** Whether anything holds a thing now: each holder takes a hold as it arrives and
 *  lets go as it leaves, by calling the function `hold` returns; a second call of
 *  that function does nothing. */
export interface Holds {
  readonly isHeld: Signal<boolean>;
  hold(): () => void;
}

export function holds(): Holds {
  const count = signal(0);
  return {
    isHeld: computed(() => count() > 0),
    hold: () => {
      count.update((held) => held + 1);
      let isHolding = true;
      return () => {
        if (isHolding) count.update((held) => held - 1);
        isHolding = false;
      };
    },
  };
}
