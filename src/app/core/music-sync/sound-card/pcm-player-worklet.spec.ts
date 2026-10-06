import { PCM_PLAYER, PcmPlayerOptions, definePcmPlayer } from './pcm-player-worklet';

interface Player {
  readonly port: { onmessage: ((event: { data: Float32Array }) => void) | null };
  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean;
}

type PlayerClass = new (options: { processorOptions: PcmPlayerOptions }) => Player;

const OPTIONS: PcmPlayerOptions = {
  channels: 2,
  startFrames: 4,
  maxFrames: 8,
  trimEveryFrames: 1000,
};
const QUANTUM = 2;

/** The player as the worklet would register it, built from its source text alone. */
function registeredPlayer(): { name: string; Player: PlayerClass } {
  const registered: { name: string; Player: PlayerClass | null } = { name: '', Player: null };
  const register = (name: string, Player: PlayerClass): void => {
    registered.name = name;
    registered.Player = Player;
  };
  class WorkletProcessor {
    readonly port = { onmessage: null };
  }
  // Built from the source text, with only the worklet's globals in reach, as the worklet does.
  const define = new Function(
    'AudioWorkletProcessor',
    'registerProcessor',
    `(${definePcmPlayer.toString()})();`,
  );
  define(WorkletProcessor, register);
  if (!registered.Player) throw new Error('nothing was registered');
  return { name: registered.name, Player: registered.Player };
}

function player(options: PcmPlayerOptions = OPTIONS) {
  const { Player } = registeredPlayer();
  const instance = new Player({ processorOptions: options });
  const send = (...samples: number[]): void =>
    instance.port.onmessage?.({ data: new Float32Array(samples) });
  const quantum = (): number[][] => {
    const output = [new Float32Array(QUANTUM), new Float32Array(QUANTUM)];
    instance.process([], [output]);
    return output.map((channel) => [...channel]);
  };
  return { send, quantum };
}

describe('the PCM player worklet', () => {
  it('registers under the name the page asks for, needing nothing outside itself', () => {
    expect(registeredPlayer().name).toBe(PCM_PLAYER);
  });

  it('plays silence until it has gathered its start margin', () => {
    const { send, quantum } = player();

    send(1, -1, 2, -2, 3, -3);

    expect(quantum()).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });

  it('then plays the frames in order, one channel to each output', () => {
    const { send, quantum } = player();

    send(1, -1, 2, -2, 3, -3);
    send(4, -4, 5, -5);

    expect(quantum()).toEqual([
      [1, 2],
      [-1, -2],
    ]);
    expect(quantum()).toEqual([
      [3, 4],
      [-3, -4],
    ]);
  });

  it('plays silence when it runs dry, and waits for its margin again', () => {
    const { send, quantum } = player();
    const silence = [
      [0, 0],
      [0, 0],
    ];
    send(1, -1, 2, -2, 3, -3, 4, -4, 5, -5);
    quantum();
    quantum();

    expect(quantum()).toEqual(silence);
    send(6, -6, 7, -7);
    expect(quantum()).toEqual(silence);
    send(8, -8);
    expect(quantum()).toEqual([
      [5, 6],
      [-5, -6],
    ]);
  });

  it('skips ahead to its start margin when too much has piled up', () => {
    const { send, quantum } = player();

    send(...Array.from({ length: 10 }, (_, frame) => [frame, -frame]).flat());

    expect(quantum()).toEqual([
      [6, 7],
      [-6, -7],
    ]);
  });

  it('skips, once a while, a backlog the last while never dipped into', () => {
    const { send, quantum } = player({ ...OPTIONS, maxFrames: 100, trimEveryFrames: 4 });

    send(...Array.from({ length: 10 }, (_, frame) => [frame, -frame]).flat());
    quantum();
    quantum();

    expect(quantum()).toEqual([
      [6, 7],
      [-6, -7],
    ]);
  });

  it('keeps the margin it did dip into', () => {
    const { send, quantum } = player({ ...OPTIONS, maxFrames: 100, trimEveryFrames: 4 });

    send(...Array.from({ length: 6 }, (_, frame) => [frame, -frame]).flat());
    quantum();
    quantum();
    send(6, -6, 7, -7);

    expect(quantum()).toEqual([
      [4, 5],
      [-4, -5],
    ]);
  });
});
