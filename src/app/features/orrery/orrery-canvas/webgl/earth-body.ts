import {
  AdditiveBlending,
  Color,
  ColorSpace,
  Group,
  Mesh,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Texture,
  Vector3,
} from 'three';
import { EARTH_RADIUS, EARTH_TURN } from '../../../../core/orrery/earth';
import {
  ATMOSPHERE_FRAGMENT,
  CLOUD_SCALE,
  SPHERE_VERTEX,
} from '../../../../shared/planets/planet-shaders';
import { EARTH_IMAGES, loadImage } from '../earth-images';
import { EARTH_CLOUD_FRAGMENT, EARTH_GROUND_FRAGMENT } from './earth-shaders';

/** The air shell's radius, in Earth radii: a thin rim, thinner than the worlds' severity air. */
const EARTH_AIR_SCALE = 1.06;
/** How fast the clouds slip past the ground, in radians a second. The ground itself holds still. */
const CLOUD_DRIFT = 0.015;
/** Sharper at a slant, up to this much: a few taps cost little and the limb reads better. */
const MAX_ANISOTROPY = 4;

export interface EarthTextures {
  readonly day: Texture;
  readonly night: Texture;
  readonly clouds: Texture;
}

const textureOf = (
  image: HTMLImageElement,
  colourSpace: ColorSpace,
  anisotropy: number,
): Texture => {
  const texture = new Texture(image);
  texture.colorSpace = colourSpace;
  texture.wrapS = RepeatWrapping;
  texture.anisotropy = Math.min(anisotropy, MAX_ANISOTROPY);
  texture.needsUpdate = true;
  return texture;
};

/**
 * The home world at the orbit origin: NASA's day side, night lights and clouds
 * on a lit sphere, wrapped in a thin rim of air. It is scenery only. It is built
 * once and owns its own GPU resources, so the worlds' scene can be rebuilt round
 * it, and released, without it; `attachTo` moves it into each new scene.
 */
export class EarthBody {
  readonly group = new Group();
  private readonly sun = new Vector3();
  private readonly ground: Mesh<SphereGeometry, ShaderMaterial>;
  private readonly clouds: Mesh<SphereGeometry, ShaderMaterial>;
  private readonly geometry = new SphereGeometry(1, 96, 64);
  private readonly textures: EarthTextures;
  private readonly materials: ShaderMaterial[];

  constructor(textures: EarthTextures, airInk: Color) {
    this.textures = textures;
    const sun = { value: this.sun };
    const ground = new ShaderMaterial({
      uniforms: {
        dayMap: { value: textures.day },
        nightMap: { value: textures.night },
        cloudMap: { value: textures.clouds },
        sun,
        cloudTurn: { value: 0 },
      },
      vertexShader: SPHERE_VERTEX,
      fragmentShader: EARTH_GROUND_FRAGMENT,
    });
    const clouds = new ShaderMaterial({
      uniforms: { cloudMap: { value: textures.clouds }, sun },
      vertexShader: SPHERE_VERTEX,
      fragmentShader: EARTH_CLOUD_FRAGMENT,
      transparent: true,
      depthWrite: false,
    });
    const rim = new ShaderMaterial({
      uniforms: { ink: { value: airInk }, sun, ground: { value: 1 / EARTH_AIR_SCALE } },
      vertexShader: SPHERE_VERTEX,
      fragmentShader: ATMOSPHERE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.materials = [ground, clouds, rim];

    this.ground = new Mesh(this.geometry, ground);
    this.ground.scale.setScalar(EARTH_RADIUS);
    this.ground.rotation.y = EARTH_TURN;
    this.clouds = new Mesh(this.geometry, clouds);
    this.clouds.scale.setScalar(EARTH_RADIUS * CLOUD_SCALE);
    this.clouds.renderOrder = 1;
    const air = new Mesh(this.geometry, rim);
    air.scale.setScalar(EARTH_RADIUS * EARTH_AIR_SCALE);
    air.renderOrder = 2;
    this.group.add(this.ground, this.clouds, air);
    this.update(0);
  }

  /** Moves the Earth into `scene`, out of any scene it was in, lit from `sun`. */
  attachTo(scene: Scene, sun: Vector3): void {
    this.sun.copy(sun);
    scene.add(this.group);
  }

  /** Sends the pictures to the GPU now, so the first frame that shows the Earth does not stall on them. */
  upload(renderer: { initTexture(texture: Texture): void }): void {
    for (const texture of Object.values(this.textures)) renderer.initTexture(texture);
  }

  /** The clouds' place at scene time `time`, in seconds. */
  update(time: number): void {
    this.clouds.rotation.y = this.ground.rotation.y + CLOUD_DRIFT * time;
    this.ground.material.uniforms['cloudTurn'].value =
      this.ground.rotation.y - this.clouds.rotation.y;
  }

  dispose(): void {
    this.group.removeFromParent();
    this.geometry.dispose();
    for (const material of this.materials) material.dispose();
    for (const texture of Object.values(this.textures)) texture.dispose();
  }
}

/** Loads the pictures and builds the Earth from them. Rejects if any will not load. */
export async function loadEarthBody(
  document: Document,
  anisotropy: number,
  airInk: Color,
): Promise<EarthBody> {
  const [day, night, clouds] = await Promise.all([
    loadImage(document, EARTH_IMAGES.day),
    loadImage(document, EARTH_IMAGES.night),
    loadImage(document, EARTH_IMAGES.clouds),
  ]);
  return new EarthBody(
    {
      day: textureOf(day, SRGBColorSpace, anisotropy),
      night: textureOf(night, SRGBColorSpace, anisotropy),
      clouds: textureOf(clouds, NoColorSpace, anisotropy),
    },
    airInk,
  );
}
