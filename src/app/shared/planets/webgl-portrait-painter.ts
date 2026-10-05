import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  Color,
  Group,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import { CLOUD_COVER, WORLD_KINDS } from '../../core/orrery/world-kind';
import {
  AIR_SCALE,
  ATMOSPHERE_FRAGMENT,
  CLOUD_FRAGMENT,
  CLOUD_SCALE,
  SPHERE_VERTEX,
  SURFACE_FRAGMENT,
  WORLD_TINT,
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
  private readonly ground: ShaderMaterial;
  private readonly air: ShaderMaterial;
  private readonly clouds: Mesh;
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

    this.ground = new ShaderMaterial({
      uniforms: {
        ink: { value: new Color() },
        seed: { value: 0 },
        kind: { value: 0 },
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
      },
      vertexShader: SPHERE_VERTEX,
      fragmentShader: SURFACE_FRAGMENT,
    });
    this.air = new ShaderMaterial({
      uniforms: {
        ink: this.ground.uniforms['ink'],
        sun: { value: this.sunLight },
        ground: { value: 1 / AIR_SCALE },
      },
      vertexShader: SPHERE_VERTEX,
      fragmentShader: ATMOSPHERE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const cloudShell = new ShaderMaterial({
      uniforms: {
        sun: { value: this.sunLight },
        seed: this.ground.uniforms['seed'],
        kind: this.ground.uniforms['kind'],
        cloudCover: this.ground.uniforms['cloudCover'],
      },
      vertexShader: SPHERE_VERTEX,
      fragmentShader: CLOUD_FRAGMENT,
      transparent: true,
      depthWrite: false,
    });
    this.worldGroup.add(new Mesh(this.geometry, this.ground));
    this.clouds = new Mesh(this.geometry, cloudShell);
    this.clouds.scale.setScalar(CLOUD_SCALE);
    this.clouds.renderOrder = 1;
    this.worldGroup.add(this.clouds);
    const airShell = new Mesh(this.geometry, this.air);
    airShell.scale.setScalar(AIR_SCALE);
    airShell.renderOrder = 2;
    this.worldGroup.add(airShell);

    this.sunSurface = new ShaderMaterial({
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
    const uniforms = this.ground.uniforms;
    uniforms['ink'].value.copy(rgb(portrait.air));
    uniforms['seed'].value = portrait.seed;
    uniforms['kind'].value = WORLD_KINDS.indexOf(portrait.kind);
    uniforms['cloudCover'].value = CLOUD_COVER[portrait.kind];
    this.clouds.visible = CLOUD_COVER[portrait.kind] > 0;
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

  dispose(): void {
    for (const resource of [
      this.geometry,
      this.ground,
      this.air,
      this.clouds.material as ShaderMaterial,
      this.quad,
      this.sunSurface,
    ]) {
      resource.dispose();
    }
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
