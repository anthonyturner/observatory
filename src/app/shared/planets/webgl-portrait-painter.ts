import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  Color,
  Group,
  IUniform,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  ShaderMaterialParameters,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import { CLOUD_COVER, WORLD_KINDS, WorldKind } from '../../core/orrery/world-kind';
import {
  AIR_SCALE,
  ATMOSPHERE_FRAGMENT,
  CLOUD_FRAGMENT,
  CLOUD_SCALE,
  SPHERE_VERTEX,
  SURFACE_FRAGMENT,
  WORLD_TINT,
  kindDefines,
} from './planet-shaders';
import {
  PortraitPainter,
  SUN_FRAME,
  SunPortrait,
  WORLD_FRAME,
  WorldPortrait,
} from './planet-portrait.types';
import { STAR_FRAGMENT, STAR_QUAD_REACH, STAR_TYPES, STAR_VERTEX } from '../gl/star-shader';

/** Narrow enough to look flat, as a far-off world does, wide enough for the shaders' view rays. */
const FIELD_OF_VIEW = 10;
const LIGHT_DISTANCE = 1000;
/** The light sits a little in front of the map, so a world shows a crescent of night, not half. */
const LIGHT_LIFT = 0.45;
/** How lively a giant's flares are: a hot spot is busy, not in crisis. */
const SUN_ACTIVITY = 0.5;

const rgb = (channels: string): Color => new Color(`rgb(${channels})`);

/**
 * One offscreen WebGL canvas that paints each world once with the orrery's
 * shaders, or a sun with the review queue's star shader, into an image. Drawn
 * over black: a page shows it with a screen blend, so black falls away and
 * the air glows over its background.
 */
export class WebglPortraitPainter implements PortraitPainter {
  private readonly gl: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(FIELD_OF_VIEW, 1, 0.1, 100);
  private readonly sunLight = new Vector3();
  private readonly geometry = new SphereGeometry(1, 64, 40);
  private readonly worldGroup = new Group();
  private readonly sunGroup = new Group();
  /** Every kind's ground and clouds read these, so a portrait sets them once. */
  private readonly groundUniforms: Record<string, IUniform>;
  /** A body, and its clouds where it has any, per kind: each kind is its own program. */
  private readonly bodies = new Map<WorldKind, readonly Mesh[]>();
  private readonly materials: ShaderMaterial[] = [];
  private readonly quad = new PlaneGeometry(2 * SUN_FRAME, 2 * SUN_FRAME);
  private readonly sunSurface: ShaderMaterial;

  /** Throws where WebGL cannot start or a shader will not compile; the caller keeps flat circles. */
  constructor(document: Document) {
    this.gl = new WebGLRenderer({
      canvas: document.createElement('canvas'),
      antialias: true,
      preserveDrawingBuffer: true,
    });
    this.gl.setClearColor('#000000', 1);
    this.gl.toneMapping = ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.05;
    this.gl.debug.onShaderError = () => {
      throw new Error('A planet shader did not compile');
    };

    this.groundUniforms = {
      ink: { value: new Color() },
      seed: { value: 0 },
      sun: { value: this.sunLight },
      centre: { value: new Vector3() },
      radius: { value: 1 },
      ringNormal: { value: new Vector3(0, 0, 1) },
      hasRing: { value: 0 },
      isMoon: { value: 0 },
      tint: { value: WORLD_TINT },
      cloudCover: { value: 0 },
      cloudTurn: { value: 0 },
      lights: { value: 0 },
      unrest: { value: 0 },
      time: { value: 0 },
      parentCentre: { value: new Vector3() },
      parentRadius: { value: 0 },
    };
    const material = (parameters: ShaderMaterialParameters): ShaderMaterial => {
      const made = new ShaderMaterial(parameters);
      this.materials.push(made);
      return made;
    };
    for (const kind of WORLD_KINDS) {
      const ground = new Mesh(
        this.geometry,
        material({
          uniforms: this.groundUniforms,
          defines: kindDefines(kind),
          vertexShader: SPHERE_VERTEX,
          fragmentShader: SURFACE_FRAGMENT,
        }),
      );
      const meshes = [ground];
      if (CLOUD_COVER[kind] > 0) {
        const clouds = new Mesh(
          this.geometry,
          material({
            uniforms: {
              sun: { value: this.sunLight },
              seed: this.groundUniforms['seed'],
              cloudCover: this.groundUniforms['cloudCover'],
            },
            defines: kindDefines(kind),
            vertexShader: SPHERE_VERTEX,
            fragmentShader: CLOUD_FRAGMENT,
            transparent: true,
            depthWrite: false,
          }),
        );
        clouds.scale.setScalar(CLOUD_SCALE);
        clouds.renderOrder = 1;
        meshes.push(clouds);
      }
      this.bodies.set(kind, meshes);
      this.worldGroup.add(...meshes);
    }
    const air = material({
      uniforms: {
        ink: this.groundUniforms['ink'],
        sun: { value: this.sunLight },
        ground: { value: 1 / AIR_SCALE },
      },
      vertexShader: SPHERE_VERTEX,
      fragmentShader: ATMOSPHERE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const airShell = new Mesh(this.geometry, air);
    airShell.scale.setScalar(AIR_SCALE);
    airShell.renderOrder = 2;
    this.worldGroup.add(airShell);

    this.sunSurface = material({
      uniforms: {
        ink: { value: new Color() },
        type: { value: 0 },
        seed: { value: 0 },
        time: { value: 0 },
        detail: { value: 1 },
        opacity: { value: 1 },
        activity: { value: SUN_ACTIVITY },
        // The quad spans SUN_FRAME sun radii each side; the shader measures in its own reach.
        disc: { value: STAR_QUAD_REACH / SUN_FRAME },
      },
      vertexShader: STAR_VERTEX,
      fragmentShader: STAR_FRAGMENT,
    });
    this.sunGroup.add(new Mesh(this.quad, this.sunSurface));

    this.scene.add(this.worldGroup, this.sunGroup);
  }

  world(portrait: WorldPortrait): string {
    const { x, y } = portrait.towardSun;
    this.sunLight.set(x, -y, LIGHT_LIFT).normalize().multiplyScalar(LIGHT_DISTANCE);
    const uniforms = this.groundUniforms;
    uniforms['ink'].value.copy(rgb(portrait.air));
    uniforms['seed'].value = portrait.seed;
    uniforms['cloudCover'].value = CLOUD_COVER[portrait.kind];
    for (const [kind, meshes] of this.bodies) {
      for (const mesh of meshes) mesh.visible = kind === portrait.kind;
    }
    this.worldGroup.visible = true;
    this.sunGroup.visible = false;
    return this.snap(portrait.px, WORLD_FRAME);
  }

  sun(portrait: SunPortrait): string {
    this.sunSurface.uniforms['ink'].value.copy(rgb(portrait.ink));
    this.sunSurface.uniforms['type'].value = STAR_TYPES.indexOf(portrait.type);
    this.worldGroup.visible = false;
    this.sunGroup.visible = true;
    return this.snap(portrait.px, SUN_FRAME);
  }

  /**
   * Compiles every kind's programs off the main thread, so the first
   * portraits do not stall the page while a driver works through them.
   */
  compile(): Promise<unknown> {
    for (const meshes of this.bodies.values()) for (const mesh of meshes) mesh.visible = true;
    this.worldGroup.visible = true;
    this.sunGroup.visible = true;
    this.camera.position.set(0, 0, 10);
    return this.gl.compileAsync(this.scene, this.camera);
  }

  dispose(): void {
    for (const resource of [this.geometry, this.quad, ...this.materials]) resource.dispose();
    this.gl.dispose();
  }

  /** Frames a body `frame` radii each side and reads the picture back. */
  private snap(px: number, frame: number): string {
    this.camera.position.set(0, 0, frame / Math.tan(((FIELD_OF_VIEW / 2) * Math.PI) / 180));
    this.camera.lookAt(0, 0, 0);
    this.gl.setSize(px, px, false);
    this.gl.render(this.scene, this.camera);
    return this.gl.domElement.toDataURL('image/png');
  }
}
