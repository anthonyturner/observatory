import { ORBIT_SQUASH } from '../../../core/orrery/orbit';
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

const ORBIT = 100;
/** How far an untilted orbit of that size reaches above and below the Earth on screen: inside its disc. */
const REACH = ORBIT * ORBIT_SQUASH;

/** On an untilted orbit a quarter turn on is toward the viewer; a quarter
 *  turn back is behind the Earth. Both land `REACH` off the Earth's centre. */
const world = (repo: string, angle: number, orbit = ORBIT): OrreryWorld =>
  ({
    project: { repo },
    color: 'red',
    orbit,
    radius: 10,
    angle,
    speed: 0,
    tilt: 0,
    delay: 0,
  }) as unknown as OrreryWorld;

const FRONT = world('o/front', Math.PI / 2);
const BEHIND = world('o/behind', -Math.PI / 2);
/** Behind the Earth, but far enough out that neither it nor its glow reaches the disc. */
const FAR_BEHIND = world('o/far', -Math.PI / 2, 400);
const FRONT_Y = CENTRE.y + REACH;
const BEHIND_Y = CENTRE.y - REACH;

const frame: SceneFrame = {
  view: VIEW,
  camera: new OrreryCamera({ x: 0, y: 0, scale: 1 }),
  time: 0,
  sinceShown: 10,
  isStill: true,
  selectedKey: null,
  earthSpin: 0,
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
    scene.setWorlds([FRONT, FAR_BEHIND]);

    const drawn = scene.draw(recordingContext(painted, false), frame);

    expect(drawn.map((world) => world.key).sort()).toEqual(['o/far', 'o/front']);
  });

  it('spends a second bloom layer only when a world behind the Earth glows over it', () => {
    const layers = () => painted.filter((step) => step !== 'earth').length;

    scene.draw(recordingContext(painted, false), frame);
    expect(layers()).toBe(2);

    painted.length = 0;
    scene.setWorlds([FRONT, FAR_BEHIND]);
    scene.draw(recordingContext(painted, false), frame);
    expect(layers()).toBe(1);
  });
});

describe('OrreryScene over the 3D view', () => {
  it('cannot pick a world through the Earth that hides it', () => {
    const scene = sceneWith([]);
    scene.setWorlds([FRONT, BEHIND, FAR_BEHIND]);

    const drawn = scene.drawOverlay(recordingContext([], false), frame);

    expect(drawn.map((world) => world.key).sort()).toEqual(['o/far', 'o/front']);
  });
});
