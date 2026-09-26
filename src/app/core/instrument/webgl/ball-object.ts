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
  Vector2,
} from 'three';
import { BallNetwork } from '../ball-network';
import { CorePose } from '../core-animator';
import { HAND_BRIGHT, HAND_GROW, HAND_LINE_BRIGHT, HAND_PUSH, HAND_REACH, HandPose } from '../hand';
import { GpuResources } from './gpu-resources';

export interface BallFrame {
  readonly pose: CorePose;
  readonly radius: number;
  readonly pixelRatio: number;
  /** Dots scale with the core, within bounds, so a phone's ball is not a smear. */
  readonly dotScale: number;
  readonly hand: HandPose;
  /** The window, in CSS pixels, to place the hand on the screen. */
  readonly viewWidth: number;
  readonly viewHeight: number;
  /** With motion off, points glow under the hand but are not pushed. */
  readonly isStill: boolean;
}

const ADDITIVE = {
  transparent: true,
  depthWrite: false,
  depthTest: false,
  blending: AdditiveBlending,
} as const;

/* `depthOf` runs from the back of the ball, 0, to its front, 1, so the back
   half sits dimmer and the ball reads round. `waveOf` is rippleAt in core-look.
   `placed` puts a point where the hand leaves it: measured on the screen, in
   CSS pixels with y up, and pushed along the screen, which is the world's xy
   since the camera looks straight down z. `handNear` is `nearness` in hand.ts. */
const SHARED_GLSL = `
  uniform float time; uniform float level; uniform float ripple; uniform float radius;
  uniform float pixelRatio; uniform float dotScale; uniform vec2 handPx; uniform float handGlow;
  uniform float reachPx; uniform float pushPx; uniform vec2 viewPx; varying float glow;
  float handNear;
  float depthOf(vec3 p) { return (modelMatrix * vec4(p, 0.)).z / radius * .5 + .5; }
  float waveOf(vec3 p) { return ripple * pow(.5 + .5 * sin(length(p) * 16. - time * 5.), 8.); }
  vec4 placed(vec3 p) {
    vec4 w = modelMatrix * vec4(p, 1.);
    vec4 c = projectionMatrix * viewMatrix * w;
    vec2 off = (c.xy / c.w * .5 + .5) * viewPx - handPx;
    float d = length(off);
    float u = min(1., d / max(reachPx, 1e-6));
    float k = 1. - u * u * (3. - 2. * u);
    handNear = handGlow * k * k;
    if (d > .001) w.xy += off / d * handNear * pushPx;
    return projectionMatrix * viewMatrix * w;
  }`;

const DOT_VERTEX = `${SHARED_GLSL}
  attribute float phase; attribute float weight;
  void main() {
    gl_Position = placed(position);
    float wave = waveOf(position);
    float twinkle = .7 + .3 * sin(time * (.6 + phase * 1.8) + phase * 40.);
    glow = level * (.55 + weight * .9) * twinkle * (.4 + .6 * depthOf(position)) * (1. + wave * 2.5)
      * (1. + handNear * ${HAND_BRIGHT.toFixed(2)});
    gl_PointSize = (1.6 + weight * 3.) * (1. + wave * .5) * (1. + handNear * ${HAND_GROW.toFixed(2)})
      * dotScale * pixelRatio;
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
    gl_Position = placed(position);
    glow = level * (.04 + .12 * strength) * (.3 + .7 * depthOf(position)) * (1. + waveOf(position) * 3.)
      * (1. + handNear * ${HAND_LINE_BRIGHT.toFixed(2)});
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
    handPx: { value: new Vector2() },
    handGlow: { value: 0 },
    reachPx: { value: 1 },
    pushPx: { value: 0 },
    viewPx: { value: new Vector2(1, 1) },
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
    // Tipped, then turned about the upright: a sideways drag always turns the
    // ball the way the hand went, however far it was tipped.
    this.group.rotation.order = 'YXZ';
    this.group.add(web, dots);
  }

  /** The ball's colour as a three.js colour, for the glow at its centre. */
  get tint(): Color {
    return this.uniforms.tint.value;
  }

  update(frame: BallFrame): void {
    const { pose, radius, pixelRatio, dotScale, hand } = frame;
    const { look } = pose;
    this.group.scale.setScalar(radius);
    this.group.rotation.set(-hand.pitch, look.spin + hand.yaw, 0);
    this.uniforms.handPx.value.set(hand.x, frame.viewHeight - hand.y);
    this.uniforms.handGlow.value = hand.glow;
    this.uniforms.reachPx.value = radius * HAND_REACH;
    this.uniforms.pushPx.value = frame.isStill ? 0 : radius * HAND_PUSH;
    this.uniforms.viewPx.value.set(frame.viewWidth, frame.viewHeight);
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
