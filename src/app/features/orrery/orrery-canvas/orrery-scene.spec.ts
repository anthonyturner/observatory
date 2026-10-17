import { OrreryCamera } from '../../../core/orrery/orrery-camera';
import { OrreryWorld } from '../../../core/orrery/world-layout';
import { OrreryPalette } from './orrery-palette';
import { OrreryScene, SceneFrame } from './orrery-scene';

const VIEW = { width: 1600, height: 900 };
const CENTRE = { x: VIEW.width / 2, y: VIEW.height / 2 };

/** What the scene painted, in order: the Earth, and each bloom layer's circles. */
type Painted = 'earth' | { readonly circles: (readonly [number, number])[] };

/** A context that draws nothing and records the Earth being clipped (on the
 *  frame) and the circles painted into the bloom layer (on the glow canvas). */
function recordingContext(painted: Painted[], isGlow: boolean): CanvasRenderingContext2D {
  return new Proxy({} as CanvasRenderingContext2D, {
    get: (_target, name) => {
      if (name === 'createRadialGradient' || name === 'createLinearGradient') {
        return () => ({ addColorStop: () => undefined });
      }
      if (name === 'measureText') return () => ({ width: 40 });
      if (name === 'clip') return () => painted.push('earth');
      if (name === 'clearRect' && isGlow) return () => painted.push({ circles: [] });
      if (name === 'arc' && isGlow) {
        return (x: number, y: number) => {
          const layer = painted.at(-1);
          if (layer && layer !== 'earth') layer.circles.push([x, y]);
        };
      }
      return () => undefined;
    },
    set: () => true,
  });
}

function sceneWith(painted: Painted[]): OrreryScene {
  const canvases = [
    { getContext: () => null },
    { getContext: () => recordingContext(painted, true) },
  ];
  const document = { createElement: () => canvases.shift() } as unknown as Document;
  const palette = { stars: ['1, 1, 1'], channels: () => '1, 1, 1' } as unknown as OrreryPalette;
  const scene = new OrreryScene(document, palette);
  scene.resize(VIEW);
  return scene;
}

/** On a flat, untilted orbit a quarter turn on is toward the viewer; a quarter
 *  turn back is behind the Earth. Both land 56px off the Earth's centre, inside its disc. */
const world = (repo: string, angle: number): OrreryWorld =>
  ({
    project: { repo },
    color: 'red',
    orbit: 100,
    radius: 10,
    angle,
    speed: 0,
    tilt: 0,
    delay: 0,
  }) as unknown as OrreryWorld;

const FRONT = world('o/front', Math.PI / 2);
const BEHIND = world('o/behind', -Math.PI / 2);
const FRONT_Y = CENTRE.y + 56;
const BEHIND_Y = CENTRE.y - 56;

const frame: SceneFrame = {
  view: VIEW,
  camera: new OrreryCamera({ x: 0, y: 0, scale: 1 }),
  time: 0,
  sinceShown: 10,
  isStill: true,
  selectedKey: null,
};

/** Where in the paint order a world's circles were drawn. */
const paintedAt = (painted: Painted[], y: number): number =>
  painted.findIndex(
    (step) => step !== 'earth' && step.circles.some(([, cy]) => Math.abs(cy - y) < 0.5),
  );

describe('OrreryScene in 2D', () => {
  let painted: Painted[];
  let scene: OrreryScene;

  beforeEach(() => {
    painted = [];
    scene = sceneWith(painted);
    scene.setWorlds([FRONT, BEHIND]);
  });

  it('paints a world behind the Earth under it, and one in front over it', () => {
    scene.draw(recordingContext(painted, false), frame);

    const earth = painted.indexOf('earth');
    expect(earth).toBeGreaterThan(-1);
    expect(paintedAt(painted, BEHIND_Y)).toBeGreaterThan(-1);
    expect(paintedAt(painted, BEHIND_Y)).toBeLessThan(earth);
    expect(paintedAt(painted, FRONT_Y)).toBeGreaterThan(earth);
  });

  it('cannot pick a world through the Earth that hides it', () => {
    const drawn = scene.draw(recordingContext(painted, false), frame);

    expect(drawn.map((world) => world.key)).toEqual(['o/front']);
  });

  it('picks a world behind the Earth once it is clear of its disc', () => {
    const clear = { ...BEHIND, orbit: 400 };
    scene.setWorlds([FRONT, clear]);

    const drawn = scene.draw(recordingContext(painted, false), frame);

    expect(drawn.map((world) => world.key).sort()).toEqual(['o/behind', 'o/front']);
  });
});
