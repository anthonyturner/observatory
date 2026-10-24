import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Points,
  Scene,
  ShaderMaterial,
} from 'three';
import { Owned } from './gpu-kit';
import { FieldStar } from './sky-model';

/** A single GPU draw for hundreds of stars, spread through an actual volume. */
export class FieldStars {
  private readonly material: ShaderMaterial;
  private readonly points: Points;
  private shown: readonly FieldStar[] | null = null;

  constructor(
    scene: Scene,
    private readonly owned: Owned,
  ) {
    this.material = owned.own(
      new ShaderMaterial({
        uniforms: { time: { value: 0 }, pixelRatio: { value: 1 } },
        vertexShader: `attribute vec3 color; attribute float size; attribute vec2 phase;
        uniform float time; uniform float pixelRatio; varying vec3 ink;
        void main() { float tw = .62 + .38 * sin(time * phase.y + phase.x);
          ink = color * tw; vec4 p = modelViewMatrix * vec4(position,1.);
          gl_Position = projectionMatrix * p; gl_PointSize = (1. + size * 2.) * pixelRatio; }`,
        fragmentShader: `varying vec3 ink; void main() { float r = length(gl_PointCoord - .5) * 2.;
        if (r > 1.) discard; gl_FragColor = vec4(ink, (1. - smoothstep(.1,1.,r))); }`,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    this.points = new Points(owned.own(new BufferGeometry()), this.material);
    scene.add(this.points);
  }

  /** Shows this field. The same field again, which the sky's layout hands back
   *  unchanged on every refresh, costs nothing. */
  load(field: readonly FieldStar[]): void {
    if (field === this.shown) return;
    this.shown = field;
    const positions: number[] = [];
    const colours: number[] = [];
    const sizes: number[] = [];
    const phases: number[] = [];
    for (const s of field) {
      positions.push(s.x, -s.y, s.z);
      const col = new Color(s.tint).multiplyScalar(s.a);
      colours.push(col.r, col.g, col.b);
      sizes.push(s.r);
      phases.push(s.phase, s.rate);
    }
    const geometry = this.owned.own(new BufferGeometry());
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colours, 3));
    geometry.setAttribute('size', new Float32BufferAttribute(sizes, 1));
    geometry.setAttribute('phase', new Float32BufferAttribute(phases, 2));
    this.owned.free(this.points.geometry);
    this.points.geometry = geometry;
  }

  update(t: number, ratio: number): void {
    this.material.uniforms['time'].value = t;
    this.material.uniforms['pixelRatio'].value = ratio;
  }
}
