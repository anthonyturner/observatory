import {
  AdditiveBlending,
  BackSide,
  Color,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  BufferGeometry,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PointLight,
  Points,
  Quaternion,
  ReinhardToneMapping,
  RingGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { growth, orbitPoint, worldPosition } from '../../../../core/orrery/orbit';
import { CAMERA_DISTANCE } from '../../../../core/orrery/orrery-camera';
import { FieldStar, starField } from '../../../../core/orrery/star-field';
import {
  OrreryWorld,
  hashString,
  outermostOrbit,
  sunRadius,
} from '../../../../core/orrery/world-layout';
import { Owned, vec } from '../../../starmap/engine/gpu-kit';
import { OrreryPalette } from '../orrery-palette';
import { DIAL_BEYOND_ORBIT, SceneFrame } from '../orrery-scene';
import {
  ATMOSPHERE_FRAGMENT,
  CORONA_FRAGMENT,
  FIELD_FRAGMENT,
  FIELD_VERTEX,
  FINISH_FRAGMENT,
  FINISH_VERTEX,
  RING_FRAGMENT,
  RING_VERTEX,
  SPHERE_VERTEX,
  SURFACE_FRAGMENT,
} from './orrery-shaders';

const DEG = Math.PI / 180;
/** Bloom only on what is luminous: deep space stays black so stars have something to be brighter than. */
const BLOOM_STRENGTH = 0.32;
const BLOOM_RADIUS = 0.25;
const BLOOM_THRESHOLD = 0.85;
/** Just bright enough that the bloom catches the sun's rim, and no more. */
const SUN_OVERBRIGHT = 1.3;
/** How far the corona reaches, in sun radii. */
const CORONA_REACH = 1.9;
/** Bloom runs at no more than this pixel ratio: it is about to be blurred. */
const BLOOM_MAX_RATIO = 1.25;
const MAX_PIXEL_RATIO = 2;
/** The dial turns this many radians a second about the plane's normal, as the 2D one does. */
const DIAL_TURN = 0.006;
/** A moon is never smaller than this many screen pixels. */
const MIN_MOON_PX = 1.3;

const rgb = (channels: string): Color => new Color(`rgb(${channels})`);

interface WorldSystem {
  readonly world: OrreryWorld;
  readonly group: Group;
  readonly body: Mesh;
  readonly surface: ShaderMaterial;
  readonly moons: Mesh<SphereGeometry, ShaderMaterial>[];
  readonly orbit: Line<BufferGeometry, LineBasicMaterial>;
  readonly colour: Color;
}

interface SceneModel {
  update(frame: SceneFrame): void;
}

/**
 * The orrery in 3D, ported from pr-starmap: lit worlds with land, rings and
 * moons, a sun with a marched corona, the dial, the star field, bloom, and a
 * vignette with grain. Labels, comets and the selection ring stay on the 2D
 * canvas over it, so they are sharp through the bloom.
 */
export class OrreryWebGL {
  private readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(30, 1, 1, 100000);
  private readonly composer: EffectComposer;
  private readonly passes: { dispose(): void }[];
  private readonly finish: ShaderPass;
  private readonly owned = new Owned();
  private readonly field: readonly FieldStar[] = starField();
  private model: SceneModel | null = null;
  private isLost = false;

  /** Throws where WebGL cannot start or a shader will not compile; the caller keeps 2D. */
  constructor(
    document: Document,
    private readonly palette: OrreryPalette,
    private readonly onLost: () => void,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-hidden', 'true');
    this.canvas.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
    this.gl = new WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      powerPreference: 'high-performance',
    });
    this.gl.setClearColor('#000000');
    this.gl.toneMapping = ReinhardToneMapping;
    this.gl.toneMappingExposure = 1.15;
    this.gl.debug.onShaderError = () => {
      throw new Error('The orrery shader did not compile');
    };
    this.composer = new EffectComposer(this.gl);
    const render = new RenderPass(this.scene, this.camera);
    const bloom = new UnrealBloomPass(
      new Vector2(1, 1),
      BLOOM_STRENGTH,
      BLOOM_RADIUS,
      BLOOM_THRESHOLD,
    );
    const output = new OutputPass();
    this.finish = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, time: { value: 0 } },
      vertexShader: FINISH_VERTEX,
      fragmentShader: FINISH_FRAGMENT,
    });
    this.passes = [render, bloom, output, this.finish];
    for (const pass of [render, bloom, output, this.finish]) this.composer.addPass(pass);
    this.canvas.addEventListener('webglcontextlost', this.lose);
  }

  /** Puts its canvas under `above`, which keeps drawing the labels. */
  mount(above: HTMLCanvasElement): void {
    above.before(this.canvas);
  }

  resize(width: number, height: number, pixelRatio: number): void {
    this.gl.setPixelRatio(Math.min(pixelRatio, MAX_PIXEL_RATIO));
    this.gl.setSize(width, height, false);
    this.composer.setPixelRatio(Math.min(pixelRatio, BLOOM_MAX_RATIO));
    this.composer.setSize(width, height);
  }

  setWorlds(worlds: readonly OrreryWorld[]): void {
    this.scene.clear();
    this.owned.disposeAll();
    this.model = this.build(worlds);
  }

  frame(frame: SceneFrame): void {
    if (this.isLost || !this.model) return;
    const { camera, view } = frame;
    const { current } = camera;
    this.camera.aspect = view.width / Math.max(1, view.height);
    this.camera.fov =
      (2 * Math.atan(view.height / (2 * CAMERA_DISTANCE * current.scale)) * 180) / Math.PI;
    this.camera.position.set(current.x, -current.y, CAMERA_DISTANCE);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this.model.update(frame);
    this.finish.uniforms['time'].value = frame.time;
    this.composer.render();
  }

  dispose(): void {
    this.canvas.removeEventListener('webglcontextlost', this.lose);
    this.owned.disposeAll();
    for (const pass of this.passes) pass.dispose();
    this.composer.dispose();
    this.gl.dispose();
    this.canvas.remove();
  }

  private readonly lose = (event: Event): void => {
    event.preventDefault();
    this.isLost = true;
    this.canvas.style.visibility = 'hidden';
    this.onLost();
  };

  private build(worlds: readonly OrreryWorld[]): SceneModel {
    const own = <T extends { dispose(): void }>(resource: T): T => this.owned.own(resource);
    const scene = this.scene;
    const updateField = this.buildField();
    const light = new PointLight('#fff2dd', 1);
    scene.add(light);
    const surfaceGeometry = own(new SphereGeometry(1, 40, 24));
    const moonGeometry = own(new SphereGeometry(1, 12, 8));
    const surface = (colour: Color, seed: number, ringNormal: Vector3, isMoon = false) =>
      own(
        new ShaderMaterial({
          uniforms: {
            ink: { value: colour },
            seed: { value: seed },
            sun: { value: light.position },
            centre: { value: new Vector3() },
            radius: { value: 1 },
            ringNormal: { value: ringNormal },
            hasRing: { value: 0 },
            isMoon: { value: isMoon ? 1 : 0 },
            parentCentre: { value: new Vector3() },
            parentRadius: { value: 0 },
          },
          vertexShader: SPHERE_VERTEX,
          fragmentShader: SURFACE_FRAGMENT,
        }),
      );
    const atmosphere = (colour: Color) =>
      own(
        new ShaderMaterial({
          uniforms: { ink: { value: colour }, sun: { value: light.position } },
          vertexShader: SPHERE_VERTEX,
          fragmentShader: ATMOSPHERE_FRAGMENT,
          transparent: true,
          depthWrite: false,
          blending: AdditiveBlending,
        }),
      );
    const line = (points: Vector3[], colour: Color, opacity: number) =>
      new Line(
        own(new BufferGeometry().setFromPoints(points)),
        own(
          new LineBasicMaterial({ color: colour, transparent: true, opacity, depthWrite: false }),
        ),
      );

    // The sun, overbright so the bloom takes it, and its corona.
    const sunSize = sunRadius(worlds);
    const sun = new Mesh(
      surfaceGeometry,
      own(
        new MeshBasicMaterial({
          color: rgb(this.palette.sunBody).multiplyScalar(SUN_OVERBRIGHT),
        }),
      ),
    );
    sun.scale.setScalar(sunSize);
    scene.add(sun);
    const corona = own(
      new ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          radius: { value: sunSize },
          reach: { value: CORONA_REACH },
        },
        vertexShader: SPHERE_VERTEX,
        fragmentShader: CORONA_FRAGMENT,
        transparent: true,
        side: BackSide,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    scene.add(new Mesh(own(new SphereGeometry(sunSize * CORONA_REACH, 32, 20)), corona));

    // The dial: two rings and 72 ticks in the plane, turning slowly.
    const dial = new Group();
    scene.add(dial);
    const far = outermostOrbit(worlds) + DIAL_BEYOND_ORBIT;
    const dialInk = rgb(this.palette.dial);
    const onPlane = (radius: number, angle: number, tilt = 0): Vector3 => {
      const p = orbitPoint(radius, angle, tilt);
      return vec(p.x, p.y, p.z);
    };
    for (const factor of [1, 0.955]) {
      const points = Array.from({ length: 193 }, (_, i) =>
        onPlane(far * factor, (i / 192) * Math.PI * 2),
      );
      dial.add(line(points, dialInk, factor === 1 ? 0.16 : 0.08));
    }
    for (let tick = 0; tick < 72; tick++) {
      const angle = tick * 5 * DEG;
      const isMajor = tick % 6 === 0;
      const points = [isMajor ? 0.93 : 0.955, 1].map((f) => onPlane(far * f, angle));
      dial.add(line(points, dialInk, isMajor ? 0.31 : 0.12));
    }
    const planeNormal = new Vector3(0, Math.sin(Math.acos(0.56)), Math.cos(Math.acos(0.56)));

    const orbitInk = rgb(this.palette.orbit);
    const moonInk = rgb(this.palette.moon);
    const systems: WorldSystem[] = worlds.map((world) => {
      const colour = rgb(this.palette.channels(world.color));
      const group = new Group();
      scene.add(group);
      const ringRotation = new Quaternion().setFromEuler(
        new Euler(1.12 + world.tilt, 0.16, world.spin * 0.14),
      );
      const ringNormal = new Vector3(0, 0, 1).applyQuaternion(ringRotation);
      const seed = hashString(world.project.repo) % 997;
      const material = surface(colour, seed, ringNormal);
      material.uniforms['hasRing'].value = world.hasRing ? 1 : 0;
      const body = new Mesh(surfaceGeometry, material);
      group.add(body);
      const air = new Mesh(surfaceGeometry, atmosphere(colour));
      air.scale.setScalar(1.045);
      group.add(air);
      if (world.hasRing) {
        const ring = new Mesh(
          own(new RingGeometry(1.76, 2.3, 96)),
          own(
            new ShaderMaterial({
              uniforms: { ink: { value: colour } },
              vertexShader: RING_VERTEX,
              fragmentShader: RING_FRAGMENT,
              side: DoubleSide,
            }),
          ),
        );
        ring.quaternion.copy(ringRotation);
        group.add(ring);
      }
      const moons = Array.from({ length: world.moons }, (_, i) => {
        const moon = new Mesh(
          moonGeometry,
          surface(moonInk.clone(), seed + i * 17, ringNormal, true),
        );
        scene.add(moon);
        return moon;
      });
      const orbit = line(
        Array.from({ length: 161 }, (_, i) =>
          onPlane(world.orbit, (i / 160) * Math.PI * 2, world.tilt),
        ),
        orbitInk.clone(),
        0.3,
      );
      scene.add(orbit);
      return { world, group, body, surface: material, moons, orbit, colour };
    });

    return {
      update: (frame) => {
        const { time, camera } = frame;
        updateField(time);
        corona.uniforms['time'].value = time;
        dial.quaternion.setFromAxisAngle(planeNormal, -time * DIAL_TURN);
        dial.visible = worlds.length > 0;
        for (const system of systems) this.updateSystem(system, frame, camera.current.scale);
      },
    };
  }

  private updateSystem(system: WorldSystem, frame: SceneFrame, scale: number): void {
    const { world, group, body, surface, moons, orbit, colour } = system;
    const grow = growth(world, frame.sinceShown);
    const radius = world.radius * grow;
    const at = worldPosition(world, frame.time);
    const isSelected = world.project.repo === frame.selectedKey;
    group.visible = grow > 0;
    group.position.copy(vec(at.x, at.y, at.z));
    group.scale.setScalar(Math.max(0.001, radius));
    body.rotation.y = world.spin + frame.time * 0.035;
    surface.uniforms['centre'].value.copy(group.position);
    surface.uniforms['radius'].value = radius;
    orbit.material.opacity = (isSelected ? 0.55 : 0.24) * grow;
    orbit.material.color.copy(isSelected ? colour : rgb(this.palette.orbit));
    moons.forEach((moon, i) => {
      const angle = world.spin + frame.time * (0.5 + i * 0.16) + (i / world.moons) * Math.PI * 2;
      // Nearly edge-on, so every moon passes in front of its world and behind it.
      const p = orbitPoint(radius * (2.7 + i * 0.34), angle, -0.36);
      moon.visible = grow > 0;
      moon.position.copy(vec(at.x + p.x, at.y + p.y, at.z + p.z));
      moon.scale.setScalar(Math.max(world.radius * 0.15, MIN_MOON_PX / scale) * grow);
      moon.material.uniforms['parentCentre'].value.copy(group.position);
      moon.material.uniforms['parentRadius'].value = radius;
    });
  }

  /** The background stars as points far behind the system, twinkling. */
  private buildField(): (time: number) => void {
    const positions: number[] = [];
    const colours: number[] = [];
    const sizes: number[] = [];
    const phases: number[] = [];
    for (const star of this.field) {
      positions.push(star.x, -star.y, star.z);
      const colour = rgb(this.palette.stars[star.tint]).multiplyScalar(star.alpha);
      colours.push(colour.r, colour.g, colour.b);
      sizes.push(star.radius);
      phases.push(star.phase, star.rate);
    }
    const geometry = this.owned.own(new BufferGeometry());
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colours, 3));
    geometry.setAttribute('size', new Float32BufferAttribute(sizes, 1));
    geometry.setAttribute('phase', new Float32BufferAttribute(phases, 2));
    const material = this.owned.own(
      new ShaderMaterial({
        uniforms: { time: { value: 0 }, pixelRatio: { value: 1 } },
        vertexShader: FIELD_VERTEX,
        fragmentShader: FIELD_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    this.scene.add(new Points(geometry, material));
    return (time) => {
      material.uniforms['time'].value = time;
      material.uniforms['pixelRatio'].value = Math.min(this.gl.getPixelRatio(), BLOOM_MAX_RATIO);
    };
  }
}
