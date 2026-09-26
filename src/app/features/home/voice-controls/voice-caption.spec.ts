import { captionFor } from './voice-caption';

describe('captionFor', () => {
  it('says both models are local while Kokoro speaks', () => {
    expect(captionFor({ engine: 'kokoro' })).toBe('Whisper hears · Kokoro speaks · both local');
  });

  it('names the ElevenLabs voice once it is known', () => {
    expect(captionFor({ engine: 'elevenlabs', voice: { id: 'rachel01', name: 'Rachel' } })).toBe(
      'Whisper hears · ElevenLabs speaks (Rachel)',
    );
    expect(captionFor({ engine: 'elevenlabs', voice: null })).toBe(
      'Whisper hears · ElevenLabs speaks',
    );
  });
});
