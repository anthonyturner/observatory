import { MusicScene } from './motifs/motif-layer';
import { SILENCE } from './music-sync.types';
import { TitleCard } from './title-card';

const SONG = { title: 'Set You Free', artist: 'N-Trance' };
const INKS = { primary: '#0ff', secondary: '#a8f', accent: '#f0f' };

/** A canvas that records where text lands and how big it is set. */
function recorder() {
  const moves: [number, number][] = [];
  const fonts: string[] = [];
  const context = {
    globalAlpha: 1,
    font: '',
    letterSpacing: '0px',
    save: () => undefined,
    restore: () => undefined,
    scale: () => undefined,
    translate: (x: number, y: number) => moves.push([x, y]),
    measureText: (text: string) => ({ width: text.length * 10 }),
    fillText: () => fonts.push(context.font),
  };
  return { context: context as unknown as CanvasRenderingContext2D, moves, fonts };
}

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

  it('sets the line just above the core, inside its box under the top bar', () => {
    const card = new TitleCard('sans-serif');
    card.announce(SONG);
    play(card, 1);
    for (const coreRadius of [36, 120, 175]) {
      const scene: MusicScene = {
        width: 1200,
        height: 900,
        originX: 600,
        originY: 300,
        coreRadius,
      };
      const { context, moves, fonts } = recorder();
      card.draw(context, scene, INKS);
      const [[x, y]] = moves;
      const titlePx = Number(/(\d+(\.\d+)?)px/.exec(fonts[1])?.[1]);
      expect(x).toBe(600);
      // Above the core's edge, descenders and all…
      expect(y + titlePx * 0.25).toBeLessThan(300 - coreRadius);
      // …and inside the core's box, under the top bar: at least 1.47 core radii up.
      expect(y - titlePx * 0.75).toBeGreaterThanOrEqual(300 - coreRadius * 1.47);
    }
  });
});
