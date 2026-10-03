import { SILENCE } from './music-sync.types';
import { TitleCard } from './title-card';

const SONG = { title: 'Set You Free', artist: 'N-Trance' };

/** Steps `card` through `seconds` of music, a frame at a time. */
function play(card: TitleCard, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) card.step(SILENCE, 1 / 60);
}

describe('TitleCard', () => {
  it('shows nothing until a song is announced', () => {
    const card = new TitleCard('sans-serif');
    play(card, 1);
    expect(card.opacity()).toBe(0);
  });

  it('fades a song in, holds it, then fades it out', () => {
    const card = new TitleCard('sans-serif');
    card.announce(SONG);
    expect(card.opacity()).toBe(0);
    play(card, 0.3);
    expect(card.opacity()).toBeGreaterThan(0);
    expect(card.opacity()).toBeLessThan(1);
    play(card, 2);
    expect(card.opacity()).toBe(1);
    play(card, 5);
    expect(card.opacity()).toBe(0);
  });

  it('starts over when the next song is announced mid-card', () => {
    const card = new TitleCard('sans-serif');
    card.announce(SONG);
    play(card, 5);
    card.announce({ title: 'Android Dreams', artist: 'Someone' });
    expect(card.opacity()).toBe(0);
    play(card, 1);
    expect(card.opacity()).toBe(1);
  });

  it('waits for the music: time passes only as the sky draws', () => {
    const card = new TitleCard('sans-serif');
    card.announce(SONG);
    play(card, 0);
    expect(card.opacity()).toBe(0);
    play(card, 1);
    expect(card.opacity()).toBe(1);
  });
});
