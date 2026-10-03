import { syncLabelOf } from './sync-label';

describe('syncLabelOf', () => {
  it('shows the button pressed only while listening', () => {
    expect(syncLabelOf('listening')).toEqual(
      expect.objectContaining({ text: 'Synced', isOn: true }),
    );
    expect(syncLabelOf('off').isOn).toBe(false);
  });

  it('tells someone who shared without sound to tick the audio box', () => {
    const label = syncLabelOf('no-audio');
    expect(label.text).toBe('No audio');
    expect(label.hint).toContain('Share tab audio');
  });

  it('turns the button off where the browser cannot share audio', () => {
    expect(syncLabelOf('unsupported').isUnavailable).toBe(true);
    expect(syncLabelOf('denied').isUnavailable).toBe(false);
  });
});
