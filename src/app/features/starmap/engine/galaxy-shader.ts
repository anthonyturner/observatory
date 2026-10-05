import { SIMPLEX_GLSL } from '../../../shared/gl/simplex-glsl';
import {
  GALAXY_CENTRE_X,
  GALAXY_CENTRE_Y,
  GALAXY_TILT,
  GALAXY_TURN,
  GALAXY_WIND,
} from './galaxy-geometry';

/** A number as a GLSL float literal. */
const glsl = (n: number): string => n.toFixed(4);

/* A spiral galaxy far behind the review queue: the Orrery has the Milky Way
   seen from inside, this sky has a neighbour seen from outside. A full-screen
   layer at the far plane, drawn first, dim, and pure scenery. */

export const GALAXY_VERTEX = `varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 1., 1.); }`;

/** A tilted disc off to one side: a warm core, two bluish arms winding out on
 *  a logarithmic spiral with pink star-forming knots and a dust lane on their
 *  inner edge, a faint halo, and a sparse haze of background stars. The arms
 *  turn by `spin`; `drift` and `zoom` give a little parallax. */
export const GALAXY_FRAGMENT = `${SIMPLEX_GLSL}
  float haze(vec3 p) { float s = 0., a = .5;
    for (int i = 0; i < 3; i++) { s += a * snoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= .5; }
    return s; }
  varying vec2 vUv;
  uniform float time, aspect, zoom, spin;
  uniform vec2 drift;
  void main() {
    vec2 p = (vUv - .5) * vec2(aspect, 1.) / zoom + drift;

    // Into the galaxy's own plane: off to the upper right, turned, and tilted away.
    vec2 q = p - vec2(${glsl(GALAXY_CENTRE_X)} * aspect, ${glsl(GALAXY_CENTRE_Y)});
    float c = cos(${glsl(GALAXY_TURN)}), s = sin(${glsl(GALAXY_TURN)});
    q = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
    q.y /= ${glsl(GALAXY_TILT)};
    float r = length(q), theta = atan(q.y, q.x);

    float wind = theta - log(max(r, .004)) * ${glsl(GALAXY_WIND)} - spin;
    float arms = pow(.5 + .5 * cos(2. * wind), 2.5);
    float lane = pow(.5 + .5 * cos(2. * wind - .7), 6.);
    float disc = exp(-r / .115);
    float core = exp(-r * r / .002);
    float halo = exp(-r / .3) * .25;
    float clumps = .6 + .4 * haze(vec3(q * 16., 5.));
    float knots = smoothstep(.55, .85, haze(vec3(q * 28., 9.)) * .5 + .5) * arms * disc;

    vec3 colour = vec3(1., .86, .64) * core * .55
      + vec3(.5, .66, 1.) * arms * disc * clumps * .36 * (1. - lane * .7)
      + vec3(1., .42, .68) * knots * .45
      + vec3(.6, .65, .85) * halo * disc * .2;

    // A sparse haze of faint stars all over the sky.
    vec2 grid = p * 220.;
    float pick = fract(sin(dot(floor(grid), vec2(12.9898, 78.233))) * 43758.5453);
    vec2 nudge = vec2(fract(pick * 17.31), fract(pick * 41.77)) - .5;
    float dot_ = smoothstep(.3, 0., length(fract(grid) - .5 - nudge * .5));
    float twinkle = .6 + .4 * sin(time * (.8 + pick * 2.6) + pick * 60.);
    colour += vec3(.82, .88, 1.) * step(.985, pick) * dot_ * twinkle * .12;

    gl_FragColor = vec4(colour, 1.);
  }`;
