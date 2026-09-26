import { CORE_CHIPS, chipOf } from './core-chips';

describe('chipOf', () => {
  it('lights the chip that lists the state', () => {
    expect(chipOf('listening').id).toBe('listening');
    expect(chipOf('routing').id).toBe('working');
    expect(chipOf('transcribing').id).toBe('working');
    expect(chipOf('running').id).toBe('working');
    expect(chipOf('speaking').id).toBe('speaking');
    expect(chipOf('error').id).toBe('error');
  });

  it('lights Idle for a reply that has landed', () => {
    expect(chipOf('answered-1').id).toBe('idle');
    expect(chipOf('answered-3').id).toBe('idle');
  });

  it('keeps pr-starmap’s order', () => {
    expect(CORE_CHIPS.map((chip) => chip.label)).toEqual([
      'Idle',
      'Listening',
      'Working',
      'Speaking',
      'Error',
    ]);
  });
});
