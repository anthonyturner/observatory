import { DecodedSound, monoOf } from './audio-decoder';

function soundOf(...channels: number[][]): DecodedSound {
  return {
    numberOfChannels: channels.length,
    length: channels[0].length,
    getChannelData: (channel: number) => new Float32Array(channels[channel]),
  };
}

describe('monoOf', () => {
  it('keeps a mono sound as it is', () => {
    expect(Array.from(monoOf(soundOf([0.5, -0.25])))).toEqual([0.5, -0.25]);
  });

  it('averages stereo into one channel', () => {
    expect(Array.from(monoOf(soundOf([0.5, 1], [-0.5, 0])))).toEqual([0, 0.5]);
  });
});
