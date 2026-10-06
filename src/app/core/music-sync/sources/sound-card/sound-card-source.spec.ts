import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { STREAM_FETCH } from '../../../runs/runs-api';
import { NoAudioError } from '../audio-tap';
import { SOUND_CARD_STREAM_URL } from './sound-card-audio';
import { SOUND_CARD_AVAILABLE } from './sound-card-availability';
import { SoundCardSource } from './sound-card-source';

function setup(isAvailable: boolean) {
  const available = signal(isAvailable);
  const asked: string[] = [];
  const fetchStream = async (url: string): Promise<Response> => {
    asked.push(url);
    return new Response('{}', { status: 503 });
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: SOUND_CARD_AVAILABLE, useValue: available },
      { provide: STREAM_FETCH, useValue: fetchStream },
    ],
  });
  return { source: TestBed.inject(SoundCardSource), available, asked };
}

describe('SoundCardSource', () => {
  it('offers Sound card where the local server can capture it', () => {
    const { source } = setup(true);

    expect(source.options()).toEqual([{ id: 'sound-card', label: 'Sound card' }]);
  });

  it('offers nothing where it cannot, and Sound card as soon as the server says it can', () => {
    const { source, available } = setup(false);
    expect(source.options()).toEqual([]);

    available.set(true);

    expect(source.options().length).toBe(1);
  });

  it('asks the local server for the stream, and reads a refusal as no audio', async () => {
    const { source, asked } = setup(true);

    await expect(source.open()).rejects.toBeInstanceOf(NoAudioError);
    expect(asked).toEqual([SOUND_CARD_STREAM_URL]);
  });
});
