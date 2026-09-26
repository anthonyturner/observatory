import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  LineSegments,
  Points,
  SRGBColorSpace,
  ShaderMaterial,
} from 'three';
import { BallNetwork } from '../ball-network';
import { CorePose } from '../core-animator';
import { GpuResources } from './gpu-resources';

export interface BallFrame {
  readonly pose: CorePose;
  readonly radius: number;
  readonly pixelRatio: number;
  /** Dots scale with the core, within bounds, so a phone's ball is not a smear. */
  readonly dotScale: number;
}

const ADDITIVE = {
  transparent: true,
  depthWrite: false,
  depthTest: false,
  blending: AdditiveBlending,
} as const;

/* `depthOf` runs from the back of the ball, 0, to its front, 1, so the back
   half sits dimmer and the ball reads round. `waveOf` is rippleAt in core-look. */
const SHARED_GLSL = `
  uniform float time; uniform float level; uniform float ripple; uniform float radius;
  uniform float pixelRatio; uniform float dotScale; varying float glow;
  float depthOf(vec3 p) { return (modelMatrix * vec4(p, 0.)).z / radius * .5 + .5; }
  float waveOf(vec3 p) { return ripple * pow(.5 + .5 * sin(length(p) * 16. - time * 5.), 8.); }`;

const DOT_VERTEX = `${SHARED_GLSL}
  attribute float phase; attribute float weight;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
    float wave = waveOf(position);
    float twinkle = .7 + .3 * sin(time * (.6 + phase * 1.8) + phase * 40.);
    glow = level * (.55 + weight * .9) * twinkle * (.4 + .6 * depthOf(position)) * (1. + wave * 2.5);
    gl_PointSize = (1.6 + weight * 3.) * (1. + wave * .5) * dotScale * pixelRatio;
  }`;

const DOT_FRAGMENT = `
  uniform vec3 tint; varying float glow;
  void main() {
    float r = length(gl_PointCoord - .5) * 2.;
    if (r > 1.) discard;
    gl_FragColor = vec4(tint * glow * pow(1. - r, 1.4), 1.);
  }`;

const LINE_VERTEX = `${SHARED_GLSL}
  attribute float strength;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
    glow = level * (.04 + .12 * strength) * (.3 + .7 * depthOf(position)) * (1. + waveOf(position) * 3.);
  }`;

const LINE_FRAGMENT = `
  uniform vec3 tint; varying float glow;
  void main() { gl_FragColor = vec4(tint * glow, 1.); }`;

interface Shaders {
  readonly vertex: string;
  readonly fragment: string;
}

const DOT_SHADERS: Shaders = { vertex: DOT_VERTEX, fragment: DOT_FRAGMENT };
const LINE_SHADERS: Shaders = { vertex: LINE_VERTEX, fragment: LINE_FRAGMENT };

/** The ball on the graphics card: its points and the lines between them, in
 *  unit space, so the group's scale sizes and breathes it. */
export class BallObject {
  readonly group = new Group();
  private readonly uniforms = {
    time: { value: 0 },
    tint: { value: new Color() },
    level: { value: 1 },
    ripple: { value: 0 },
    radius: { value: 1 },
    pixelRatio: { value: 1 },
    dotScale: { value: 1 },
  };

  constructor(network: BallNetwork, resources: GpuResources) {
    const dots = new Points(
      this.dotGeometry(network, resources),
      this.material(resources, DOT_SHADERS),
    );
    const web = new LineSegments(
      this.webGeometry(network, resources),
      this.material(resources, LINE_SHADERS),
    );
    dots.frustumCulled = false;
    web.frustumCulled = false;
    this.group.add(web, dots);
  }

  /** The ball's colour as a three.js colour, for the glow at its centre. */
  get tint(): Color {
    return this.uniforms.tint.value;
  }

  update({ pose, radius, pixelRatio, dotScale }: BallFrame): void {
    const { look } = pose;
    this.group.scale.setScalar(radius);
    this.group.rotation.set(0, look.spin, 0);
    this.uniforms.time.value = look.time;
    this.uniforms.tint.value.setRGB(look.tint[0], look.tint[1], look.tint[2], SRGBColorSpace);
    this.uniforms.level.value = look.level * pose.intro;
    this.uniforms.ripple.value = look.ripple;
    this.uniforms.radius.value = radius;
    this.uniforms.pixelRatio.value = pixelRatio;
    this.uniforms.dotScale.value = dotScale;
  }

  private material(resources: GpuResources, shaders: Shaders): ShaderMaterial {
    return resources.own(
      new ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: shaders.vertex,
        fragmentShader: shaders.fragment,
        ...ADDITIVE,
      }),
    );
  }

  private dotGeometry(network: BallNetwork, resources: GpuResources): BufferGeometry {
    const geometry = resources.own(new BufferGeometry());
    geometry.setAttribute('position', new BufferAttribute(network.points, 3));
    geometry.setAttribute('phase', new BufferAttribute(network.phases, 1));
    geometry.setAttribute('weight', new BufferAttribute(network.weights, 1));
    return geometry;
  }

  private webGeometry(network: BallNetwork, resources: GpuResources): BufferGeometry {
    const { points, links } = network;
    const positions: number[] = [];
    const strengths: number[] = [];
    for (let i = 0; i < links.length; i += 3) {
      const a = links[i] * 3;
      const b = links[i + 1] * 3;
      positions.push(
        points[a],
        points[a + 1],
        points[a + 2],
        points[b],
        points[b + 1],
        points[b + 2],
      );
      strengths.push(links[i + 2], links[i + 2]);
    }
    const geometry = resources.own(new BufferGeometry());
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('strength', new Float32BufferAttribute(strengths, 1));
    return geometry;
  }
}
