import { syncLabelOf } from './sync-label';

const guide = {
  ask: 'Chrome asks to share a screen: tick “Also share system audio”.',
  silent: 'The screen was shared without the computer’s sound',
};

describe('syncLabelOf', () => {
  it('shows the button pressed only while listening', () => {
    expect(syncLabelOf('listening', guide)).toEqual(
      expect.objectContaining({ text: 'Synced', isOn: true }),
    );
    expect(syncLabelOf('off', guide).isOn).toBe(false);
  });

  it('tells someone who shared without sound to tick the chosen source’s audio box', () => {
    const label = syncLabelOf('no-audio', guide);
    expect(label.text).toBe('No audio');
    expect(label.hint).toContain(guide.silent);
    expect(label.hint).toContain('Also share system audio');
  });

  it('says what the browser will ask for the chosen source before and while asking', () => {
    expect(syncLabelOf('off', guide).hint).toContain(guide.ask);
    expect(syncLabelOf('asking', guide).hint).toBe(guide.ask);
    expect(syncLabelOf('denied', guide).hint).toContain(guide.ask);
  });

  it('turns the button off where the browser cannot capture the sound', () => {
    expect(syncLabelOf('unsupported', guide).isUnavailable).toBe(true);
    expect(syncLabelOf('denied', guide).isUnavailable).toBe(false);
  });
});
