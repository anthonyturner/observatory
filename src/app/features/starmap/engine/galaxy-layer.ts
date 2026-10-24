import {
  Camera,
  HalfFloatType,
  Mesh,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { GALAXY_DISC_FRAGMENT, GALAXY_FRAGMENT, GALAXY_VERTEX } from './galaxy-shader';
import { GalaxyUniforms, galaxyShift, galaxyUniforms, galaxyView } from './galaxy-geometry';
import { Owned } from './gpu-kit';
import { SkyFrame } from './sky-frame';

/** A drawn disc this far off, in texels, is not told from a fresh one. */
const MAX_STALE_TEXELS = 0.25;

/**
 * The spiral galaxy behind the review queue, a full-screen layer at the far
 * plane. Its disc is smooth and costs six noise samples a pixel, so it is drawn
 * into a picture of its own at a fraction of the screen's size, and drawn again
 * only once the camera or the arms' turn has moved it far enough to show. Each
 * frame the picture is stretched across the screen with the faint field of
 * stars on top, which are sharp and cheap and so stay at full size.
 */
export class GalaxyLayer {
  private readonly picture = new WebGLRenderTarget(2, 2, {
    type: HalfFloatType,
    depthBuffer: false,
  });
  private readonly drawing = new Scene();
  private readonly lens = new Camera();
  private readonly disc: ShaderMaterial;
  private readonly sky: ShaderMaterial;
  private drawn: GalaxyUniforms | null = null;

  constructor(scene: Scene, owned: Owned) {
    owned.own(this.picture);
    const geometry = owned.own(new PlaneGeometry(2, 2));
    const view = () => ({
      aspect: { value: 1 },
      zoom: { value: 1 },
      drift: { value: new Vector2() },
    });
    this.disc = owned.own(
      new ShaderMaterial({
        uniforms: { ...view(), spin: { value: 0 } },
        vertexShader: GALAXY_VERTEX,
        fragmentShader: GALAXY_DISC_FRAGMENT,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.sky = owned.own(
      new ShaderMaterial({
        uniforms: { ...view(), time: { value: 0 }, disc: { value: this.picture.texture } },
        vertexShader: GALAXY_VERTEX,
        fragmentShader: GALAXY_FRAGMENT,
        depthTest: false,
        depthWrite: false,
      }),
    );
    for (const [target, material] of [
      [this.drawing, this.disc],
      [scene, this.sky],
    ] as const) {
      const quad = new Mesh(geometry, material);
      quad.frustumCulled = false;
      quad.renderOrder = -1;
      target.add(quad);
    }
  }

  /** Brings the layer to this frame. `texelsPerPixel` sizes the picture of the
   *  disc against the screen's pixels; it is drawn into `gl` when it is stale. */
  update(f: SkyFrame, gl: WebGLRenderer, texelsPerPixel: number): void {
    const now = galaxyUniforms(galaxyView(f));
    const wide = Math.max(2, Math.round(f.width * texelsPerPixel));
    const high = Math.max(2, Math.round(f.height * texelsPerPixel));
    if (this.picture.width !== wide || this.picture.height !== high) {
      this.picture.setSize(wide, high);
      this.drawn = null;
    }
    if (!this.drawn || galaxyShift(this.drawn, now, high) > MAX_STALE_TEXELS) {
      this.redraw(gl, now);
    }
    this.sky.uniforms['time'].value = f.frozen ? 0 : f.t;
    this.sky.uniforms['aspect'].value = now.aspect;
    this.sky.uniforms['zoom'].value = now.zoom;
    this.sky.uniforms['drift'].value.set(now.driftX, now.driftY);
  }

  private redraw(gl: WebGLRenderer, now: GalaxyUniforms): void {
    const { uniforms } = this.disc;
    uniforms['aspect'].value = now.aspect;
    uniforms['zoom'].value = now.zoom;
    uniforms['spin'].value = now.spin;
    uniforms['drift'].value.set(now.driftX, now.driftY);
    const before = gl.getRenderTarget();
    gl.setRenderTarget(this.picture);
    gl.render(this.drawing, this.lens);
    gl.setRenderTarget(before);
    this.drawn = now;
  }
}
