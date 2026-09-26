import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Points,
  ShaderMaterial,
} from 'three';
import { Bead, LIT_BEAD_GROWTH, stalePulse } from '../beads';
import { CoreFrame } from '../core-renderer';
import { CorePose, beadGrowth } from '../core-animator';
import { CAMERA_DEPTH } from '../proportions';
import { GpuResources } from './gpu-resources';

/* A bead's point is 2.6 beads wide: its core, a halo, and for a blocked
   project the small ring the star map uses for "blocked". `grown` scales it
   in as it grows in on load. */
const VERTEX = `
  attribute vec3 color; attribute float size; attribute float ringed; attribute float grown;
  attribute float lit; attribute float stale;
  uniform float pixelRatio; uniform float depth; varying vec3 ink; varying float ring;
  varying float bright; varying float fading;
  void main() {
    vec4 p = modelViewMatrix * vec4(position, 1.);
    gl_Position = projectionMatrix * p;
    ink = color * grown;
    ring = ringed;
    bright = lit;
    fading = stale;
    gl_PointSize = size * 2. * 2.6 * (1. + lit * ${(LIT_BEAD_GROWTH - 1).toFixed(2)}) * (depth / -p.z) * pixelRatio * max(grown, .001);
  }`;

const FRAGMENT = `
  uniform vec3 staleInk;
  varying vec3 ink; varying float ring; varying float bright; varying float fading;
  void main() {
    float r = length(gl_PointCoord - .5) * 2.;
    if (r > 1.) discard;
    float core = 1. - smoothstep(.3, .38, r);
    float halo = pow(1. - r, 2.4) * (.5 + bright * .7);
    float band = ring * (1. - smoothstep(.02, .07, abs(r - .74)));
    float neglect = fading * (1. - smoothstep(.015, .05, abs(r - .92)));
    gl_FragColor = vec4(ink * (core * (1.5 + bright) + halo) + mix(ink, vec3(1.), .3) * band + staleInk * neglect, 1.);
  }`;

/** One glowing point per project on the orbit. */
export class BeadPoints {
  readonly points: Points;
  private readonly grown: Float32BufferAttribute;
  private readonly lit: Float32BufferAttribute;
  private readonly stale: Float32BufferAttribute;
  private readonly material: ShaderMaterial;

  constructor(
    private readonly beads: readonly Bead[],
    colourOf: (bead: Bead) => string,
    staleColour: string,
    resources: GpuResources,
  ) {
    const geometry = resources.own(new BufferGeometry());
    const colours = beads.flatMap((bead) =>
      new Color(colourOf(bead)).multiplyScalar(bead.dim).toArray(),
    );
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute(
        beads.flatMap((b) => [b.x, b.y, b.z]),
        3,
      ),
    );
    geometry.setAttribute('color', new Float32BufferAttribute(colours, 3));
    geometry.setAttribute(
      'size',
      new Float32BufferAttribute(
        beads.map((b) => b.size),
        1,
      ),
    );
    geometry.setAttribute(
      'ringed',
      new Float32BufferAttribute(
        beads.map((b) => (b.isRinged ? 1 : 0)),
        1,
      ),
    );
    this.grown = new Float32BufferAttribute(new Float32Array(beads.length), 1);
    geometry.setAttribute('grown', this.grown);
    this.lit = new Float32BufferAttribute(new Float32Array(beads.length), 1);
    geometry.setAttribute('lit', this.lit);
    this.stale = new Float32BufferAttribute(new Float32Array(beads.length), 1);
    geometry.setAttribute('stale', this.stale);
    this.material = resources.own(
      new ShaderMaterial({
        uniforms: {
          pixelRatio: { value: 1 },
          depth: { value: CAMERA_DEPTH },
          staleInk: { value: new Color(staleColour) },
        },
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: AdditiveBlending,
      }),
    );
    this.points = new Points(geometry, this.material);
    this.points.frustumCulled = false;
  }

  update(pose: CorePose, pixelRatio: number, frame: CoreFrame): void {
    this.beads.forEach((bead, i) => {
      this.grown.setX(i, beadGrowth(pose, bead));
      this.lit.setX(i, bead.key === frame.litKey ? 1 : 0);
      this.stale.setX(i, stalePulse(bead.staleness, frame.time, frame.isStill));
    });
    this.grown.needsUpdate = true;
    this.lit.needsUpdate = true;
    this.stale.needsUpdate = true;
    this.material.uniforms['pixelRatio'].value = pixelRatio;
  }
}
