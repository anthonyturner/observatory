import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  Quaternion,
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
import { DepthPlanes, depthPlanes } from '../../../../core/orrery/depth-planes';
import { growth, orbitPoint, worldPosition } from '../../../../core/orrery/orbit';
import { CAMERA_DISTANCE } from '../../../../core/orrery/orrery-camera';
import {
  FIELD_SPREAD_3D,
  FIELD_STARS_3D,
  FieldStar,
  starField,
} from '../../../../core/orrery/star-field';
import { dialRadius, sunPlacement } from '../../../../core/orrery/sun-placement';
import {
  MOON_TILT,
  OrreryWorld,
  RING_INNER,
  RING_OUTER,
  hashString,
  moonOrbitRadius,
  moonRadius,
} from '../../../../core/orrery/world-layout';
import { CLOUD_COVER, WorldKind, worldKind } from '../../../../core/orrery/world-kind';
import { nightSide } from '../../../../core/orrery/world-night';
import { DIM_TOTAL_S, dimAt, dimSpot } from '../../../../core/orrery/merge-arrival';
import { Owned, vec } from '../../../starmap/engine/gpu-kit';
import { OrreryPalette } from '../orrery-palette';
import { SceneFrame } from '../orrery-scene';
import { EarthBody, loadEarthBody } from './earth-body';
import { buildSun } from './sun-body';
import {
  FIELD_FRAGMENT,
  FIELD_VERTEX,
  FINISH_FRAGMENT,
  FINISH_VERTEX,
  RING_FRAGMENT,
  RING_VERTEX,
} from './orrery-shaders';
import { MILKY_WAY_FRAGMENT, MILKY_WAY_VERTEX } from './milky-way-shader';
import { SKY_TURN, skyUniforms } from '../milky-way-geometry';
import {
  AIR_SCALE,
  ATMOSPHERE_FRAGMENT,
  CLOUD_FRAGMENT,
  CLOUD_SCALE,
  SPHERE_VERTEX,
  SURFACE_FRAGMENT,
  WORLD_TINT,
  kindDefines,
} from '../../../../shared/planets/planet-shaders';

const DEG = Math.PI / 180;
/** The 3D sky holds more stars over a wider field, so it can turn without bare corners. */
/** Bloom only on what is luminous: deep space stays black so stars have something to be brighter than. */
const BLOOM_STRENGTH = 0.32;
const BLOOM_RADIUS = 0.25;
const BLOOM_THRESHOLD = 0.85;
/** Bloom runs at no more than this pixel ratio: it is about to be blurred. */
const BLOOM_MAX_RATIO = 1.25;
const MAX_PIXEL_RATIO = 2;
/** The dial turns this many radians a second about the plane's normal, as the 2D one does. */
const DIAL_TURN = 0.006;
/** A moon is cratered rock in the palette's moon grey. */
const MOON_TINT = 0.7;
/** Clouds turn a little faster than the ground beneath them, in radians a second. */
const GROUND_TURN = 0.035;
const CLOUD_TURN = 0.05;
/** A moon is never smaller than this many screen pixels. */

const rgb = (channels: string): Color => new Color(`rgb(${channels})`);

interface WorldSystem {
  readonly world: OrreryWorld;
  readonly group: Group;
  readonly body: Mesh;
  readonly surface: ShaderMaterial;
  readonly clouds: Mesh | null;
  readonly moons: Mesh<SphereGeometry, ShaderMaterial>[];
  readonly orbit: Line<BufferGeometry, LineBasicMaterial>;
  readonly colour: Color;
}

/** A world's city light put down by a merge: when, and where on its ground (once chosen). */
interface Dimming {
  readonly startedAt: number;
  spot: Vector3 | null;
}

interface SceneModel {
  /** Where the sun, its corona and the light are in this scene, which the Earth is lit from. */
  readonly sun: Vector3;
  /** The camera's near and far planes that hug this scene. */
  readonly planes: DepthPlanes;
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
  private scene = new Scene();
  /** Its near and far planes are set from the scene on every frame. */
  private readonly camera = new PerspectiveCamera(30, 1);
  private readonly composer: EffectComposer;
  private readonly renderPass: RenderPass;
  private readonly passes: { dispose(): void }[];
  private readonly finish: ShaderPass;
  private owned = new Owned();
  /** Counts builds, so a slow compile cannot swap in worlds a newer build replaced. */
  private builds = 0;
  private isDisposed = false;
  private readonly field: readonly FieldStar[] = starField(FIELD_STARS_3D, FIELD_SPREAD_3D);
  private model: SceneModel | null = null;
  /** By repository, so a rebuild of the worlds in the middle of one does not lose it. */
  private readonly dimmings = new Map<string, Dimming>();
  private isLost = false;
  /** The Earth lives outside the worlds' scene, which is rebuilt on every refresh: it is built once, from its pictures. */
  private readonly earth: Promise<EarthBody>;
  private earthBody: EarthBody | null = null;

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
    // Filmic: deeper shadows and saturated mid-tones, so the surfaces read as lit rock and cloud.
    this.gl.toneMapping = ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.05;
    this.gl.debug.onShaderError = () => {
      throw new Error('The orrery shader did not compile');
    };
    this.composer = new EffectComposer(this.gl);
    const render = new RenderPass(this.scene, this.camera);
    this.renderPass = render;
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
    this.earth = loadEarthBody(
      document,
      this.gl.capabilities.getMaxAnisotropy(),
      rgb(palette.earthAir),
    ).then((body) => {
      if (this.isDisposed) body.dispose();
      else this.earthBody = body;
      return body;
    });
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

  /**
   * Builds the worlds into a new scene and compiles its shaders, and the
   * Earth's, off the main thread, which a driver can take seconds over. The
   * scene on screen stays until the new one can draw without stalling; resolves
   * once it is shown. Rejects if the Earth's pictures cannot load.
   */
  async setWorlds(worlds: readonly OrreryWorld[]): Promise<void> {
    const build = ++this.builds;
    const earth = await this.earth;
    if (this.isDisposed) return;
    earth.upload(this.gl);
    const scene = new Scene();
    const owned = new Owned();
    const model = this.build(worlds, scene, owned);
    await this.compile(scene, earth);
    if (build !== this.builds || this.isDisposed) {
      owned.disposeAll();
      return;
    }
    // The Earth moves out of the old scene only now, so that one keeps drawing it until this one can.
    earth.attachTo(scene, model.sun);
    // The old scene's programs stay held until here, so the new one reuses them.
    const old = this.owned;
    this.scene = scene;
    this.owned = owned;
    this.model = model;
    this.renderPass.scene = scene;
    old.disposeAll();
  }

  frame(frame: SceneFrame): void {
    if (this.isLost || !this.model) return;
    const { camera, view } = frame;
    const { current } = camera;
    this.camera.aspect = view.width / Math.max(1, view.height);
    this.camera.fov =
      (2 * Math.atan(view.height / (2 * CAMERA_DISTANCE * current.scale)) * 180) / Math.PI;
    this.camera.position.set(current.x, -current.y, CAMERA_DISTANCE);
    this.camera.near = this.model.planes.near;
    this.camera.far = this.model.planes.far;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this.earthBody?.update(frame.time);
    this.model.update(frame);
    this.finish.uniforms['time'].value = frame.time;
    this.composer.render();
  }

  dispose(): void {
    this.isDisposed = true;
    this.canvas.removeEventListener('webglcontextlost', this.lose);
    this.owned.disposeAll();
    this.earthBody?.dispose();
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

  /** A program is built for the target it draws into, so compile against the composer's.
   *  The Earth is compiled into the new scene's lighting without being added to it yet. */
  private compile(scene: Scene, earth: EarthBody): Promise<unknown> {
    const target = this.gl.getRenderTarget();
    this.gl.setRenderTarget(this.composer.readBuffer);
    const compiled = Promise.all([
      this.gl.compileAsync(scene, this.camera),
      this.gl.compileAsync(earth.group, this.camera, scene),
    ]);
    this.gl.setRenderTarget(target);
    return compiled;
  }

  private build(worlds: readonly OrreryWorld[], scene: Scene, owned: Owned): SceneModel {
    const own = <T extends { dispose(): void }>(resource: T): T => owned.own(resource);
    const updateSky = this.buildMilkyWay(scene, owned);
    const updateField = this.buildField(scene, owned);
    const surfaceGeometry = own(new SphereGeometry(1, 64, 40));
    const {
      light,
      position: sunPosition,
      coronaMaterial,
    } = buildSun(scene, sunPlacement(worlds), rgb(this.palette.sunBody), surfaceGeometry, owned);
    const moonGeometry = own(new SphereGeometry(1, 20, 14));
    const surface = (
      colour: Color,
      seed: number,
      ringNormal: Vector3,
      kind: WorldKind,
      isMoon = false,
    ) =>
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
            tint: { value: isMoon ? MOON_TINT : WORLD_TINT },
            cloudCover: { value: isMoon ? 0 : CLOUD_COVER[kind] },
            cloudTurn: { value: 0 },
            lights: { value: 0 },
            dim: { value: 0 },
            dimSpot: { value: new Vector3(0, 0, 1) },
            unrest: { value: 0 },
            time: { value: 0 },
            parentCentre: { value: new Vector3() },
            parentRadius: { value: 0 },
          },
          defines: kindDefines(kind),
          vertexShader: SPHERE_VERTEX,
          fragmentShader: SURFACE_FRAGMENT,
        }),
      );
    const cloudShell = (ground: ShaderMaterial) =>
      own(
        new ShaderMaterial({
          uniforms: {
            sun: { value: light.position },
            seed: ground.uniforms['seed'],
            cloudCover: ground.uniforms['cloudCover'],
          },
          defines: ground.defines,
          vertexShader: SPHERE_VERTEX,
          fragmentShader: CLOUD_FRAGMENT,
          transparent: true,
          depthWrite: false,
        }),
      );
    const atmosphere = (colour: Color) =>
      own(
        new ShaderMaterial({
          uniforms: {
            ink: { value: colour },
            sun: { value: light.position },
            ground: { value: 1 / AIR_SCALE },
          },
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

    // The dial: two rings and 72 ticks in the plane, turning slowly.
    const dial = new Group();
    scene.add(dial);
    const far = dialRadius(worlds);
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
      const kind = worldKind(world.project.repo);
      const material = surface(colour, seed, ringNormal, kind);
      const night = nightSide(world.project);
      material.uniforms['lights'].value = night.lights;
      material.uniforms['unrest'].value = night.unrest;
      material.uniforms['hasRing'].value = world.hasRing ? 1 : 0;
      const body = new Mesh(surfaceGeometry, material);
      group.add(body);
      const air = new Mesh(surfaceGeometry, atmosphere(colour));
      air.scale.setScalar(AIR_SCALE);
      air.renderOrder = 2;
      group.add(air);
      const clouds = CLOUD_COVER[kind] > 0 ? new Mesh(surfaceGeometry, cloudShell(material)) : null;
      if (clouds) {
        clouds.scale.setScalar(CLOUD_SCALE);
        clouds.renderOrder = 1;
        group.add(clouds);
      }
      if (world.hasRing) {
        const ring = new Mesh(
          own(new RingGeometry(RING_INNER, RING_OUTER, 96)),
          own(
            new ShaderMaterial({
              uniforms: {
                ink: { value: colour },
                sun: { value: light.position },
                seed: { value: seed },
              },
              vertexShader: RING_VERTEX,
              fragmentShader: RING_FRAGMENT,
              side: DoubleSide,
              transparent: true,
              depthWrite: false,
            }),
          ),
        );
        ring.quaternion.copy(ringRotation);
        ring.renderOrder = 3;
        group.add(ring);
      }
      const moons = Array.from({ length: world.moons }, (_, i) => {
        const moon = new Mesh(
          moonGeometry,
          surface(moonInk.clone(), seed + i * 17, ringNormal, 'desert', true),
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
      return { world, group, body, surface: material, clouds, moons, orbit, colour };
    });

    return {
      sun: sunPosition,
      planes: depthPlanes(worlds),
      update: (frame) => {
        const { time, camera } = frame;
        updateSky(frame);
        updateField(time, time * SKY_TURN);
        coronaMaterial.uniforms['time'].value = time;
        dial.quaternion.setFromAxisAngle(planeNormal, -time * DIAL_TURN);
        dial.visible = worlds.length > 0;
        for (const system of systems) this.updateSystem(system, frame, camera.current.scale);
      },
    };
  }

  /** Puts one of the world's city lights down, from scene time `time`, on the night side that faces us. */
  dimLight(repo: string, time: number): void {
    // A world that is gone is never drawn again to retire its own, so finished ones go here.
    for (const [key, { startedAt }] of this.dimmings) {
      if (time - startedAt >= DIM_TOTAL_S) this.dimmings.delete(key);
    }
    this.dimmings.set(repo, { startedAt: time, spot: null });
  }

  private updateDimming(system: WorldSystem, frame: SceneFrame): void {
    const { world, group, body, surface } = system;
    const repo = world.project.repo;
    const dimming = this.dimmings.get(repo);
    const elapsed = dimming ? frame.time - dimming.startedAt : DIM_TOTAL_S;
    if (!dimming || elapsed >= DIM_TOTAL_S) {
      this.dimmings.delete(repo);
      surface.uniforms['dim'].value = 0;
      return;
    }
    // Chosen on the first frame it is drawn, from where the world and the viewer are then.
    dimming.spot ??= this.groundSpot(
      group.position,
      surface.uniforms['sun'].value,
      body.rotation.y,
    );
    surface.uniforms['dimSpot'].value.copy(dimming.spot);
    surface.uniforms['dim'].value = frame.isStill ? 0 : dimAt(elapsed);
  }

  /** The night-side point nearest the viewer, in the world's own coordinates. */
  private groundSpot(centre: Vector3, sun: Vector3, turn: number): Vector3 {
    const towardSun = sun.clone().sub(centre);
    const towardViewer = this.camera.position.clone().sub(centre);
    const [x, y, z] = dimSpot(
      [towardSun.x, towardSun.y, towardSun.z],
      [towardViewer.x, towardViewer.y, towardViewer.z],
    );
    // The ground turns about y; undo that turn to find the same point on the ground itself.
    return new Vector3(x, y, z).applyAxisAngle(new Vector3(0, 1, 0), -turn);
  }

  private updateSystem(system: WorldSystem, frame: SceneFrame, scale: number): void {
    const { world, group, body, surface, clouds, moons, orbit, colour } = system;
    const grow = growth(world, frame.sinceShown);
    const radius = world.radius * grow;
    const at = worldPosition(world, frame.time);
    const isSelected = world.project.repo === frame.selectedKey;
    group.visible = grow > 0;
    group.position.copy(vec(at.x, at.y, at.z));
    group.scale.setScalar(Math.max(0.001, radius));
    body.rotation.y = world.spin + frame.time * GROUND_TURN;
    if (clouds) {
      clouds.rotation.y = world.spin * 1.3 + frame.time * CLOUD_TURN;
      surface.uniforms['cloudTurn'].value = body.rotation.y - clouds.rotation.y;
    }
    surface.uniforms['time'].value = frame.time;
    this.updateDimming(system, frame);
    surface.uniforms['centre'].value.copy(group.position);
    surface.uniforms['radius'].value = radius;
    orbit.material.opacity = (isSelected ? 0.55 : 0.24) * grow;
    orbit.material.color.copy(isSelected ? colour : rgb(this.palette.orbit));
    moons.forEach((moon, i) => {
      const angle = world.spin + frame.time * (0.5 + i * 0.16) + (i / world.moons) * Math.PI * 2;
      // Nearly edge-on, so every moon passes in front of its world and behind it.
      const p = orbitPoint(moonOrbitRadius(radius, i), angle, MOON_TILT);
      moon.visible = grow > 0;
      moon.position.copy(vec(at.x + p.x, at.y + p.y, at.z + p.z));
      moon.scale.setScalar(moonRadius(world.radius, scale) * grow);
      moon.material.uniforms['parentCentre'].value.copy(group.position);
      moon.material.uniforms['parentRadius'].value = radius;
    });
  }

  /** The Milky Way: a full-screen layer behind everything, turning with the stars. */
  private buildMilkyWay(scene: Scene, owned: Owned): (frame: SceneFrame) => void {
    const material = owned.own(
      new ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          aspect: { value: 1 },
          zoom: { value: 1 },
          turn: { value: 0 },
          drift: { value: new Vector2() },
        },
        vertexShader: MILKY_WAY_VERTEX,
        fragmentShader: MILKY_WAY_FRAGMENT,
        depthTest: false,
        depthWrite: false,
      }),
    );
    const sky = new Mesh(owned.own(new PlaneGeometry(2, 2)), material);
    sky.frustumCulled = false;
    sky.renderOrder = -1;
    scene.add(sky);
    return ({ time, view, camera }) => {
      const { aspect, zoom, turn, driftX, driftY } = skyUniforms({
        view,
        camera: camera.current,
        time,
      });
      material.uniforms['time'].value = time;
      material.uniforms['aspect'].value = aspect;
      material.uniforms['zoom'].value = zoom;
      material.uniforms['turn'].value = turn;
      material.uniforms['drift'].value.set(driftX, driftY);
    };
  }

  /** The background stars as points far behind the system, twinkling. */
  private buildField(scene: Scene, owned: Owned): (time: number, turn: number) => void {
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
    const geometry = owned.own(new BufferGeometry());
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colours, 3));
    geometry.setAttribute('size', new Float32BufferAttribute(sizes, 1));
    geometry.setAttribute('phase', new Float32BufferAttribute(phases, 2));
    const material = owned.own(
      new ShaderMaterial({
        uniforms: { time: { value: 0 }, pixelRatio: { value: 1 } },
        vertexShader: FIELD_VERTEX,
        fragmentShader: FIELD_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    const points = new Points(geometry, material);
    scene.add(points);
    return (time, turn) => {
      points.rotation.z = turn;
      material.uniforms['time'].value = time;
      material.uniforms['pixelRatio'].value = Math.min(this.gl.getPixelRatio(), BLOOM_MAX_RATIO);
    };
  }
}
