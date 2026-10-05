import { SIMPLEX_GLSL } from './simplex-glsl';

/* A pull request's star, drawn on a camera-facing quad. Far off it is a calm
   point with a soft glow; as the camera closes in (`detail` rising to 1) its
   disc grows into the gap the links leave round it and shows a surface: limb
   darkening, churning granulation, a corona, and what its type adds. */

/** How far the quad reaches, in units of `starRadius`: the old sprite's extent. */
export const STAR_QUAD_REACH = 128 / 14 / 2;

/** What a star is, in the order the star shader numbers them. */
export type StarType = 'bright' | 'giant' | 'veiled' | 'calm';
export const STAR_TYPES: readonly StarType[] = ['bright', 'giant', 'veiled', 'calm'];

export const STAR_VERTEX = `varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;

/** Types, numbered as STAR_TYPES orders them: bright, giant, veiled, calm. */
export const STAR_FRAGMENT = `${SIMPLEX_GLSL}
  varying vec2 vUv;
  uniform vec3 ink;
  uniform float type, seed, time, detail, opacity, activity, disc;
  void main() {
    // q is in disc radii: the disc's edge is at length(q) == 1.
    vec2 q = (vUv - .5) * 2. * ${STAR_QUAD_REACH.toFixed(4)} / disc;
    float d = length(q), aa = fwidth(d) * 1.5;
    float edge = 1. - smoothstep(.7, 1., length(vUv - .5) * 2.);
    vec3 white = vec3(1., .97, .92);
    bool giant = type > .5 && type < 1.5, veiled = type > 1.5 && type < 2.5, calm = type > 2.5;

    // Far off: a small hot core in a soft glow, as the sky has always drawn it.
    float core = 1. - smoothstep(.6, 1.1, d);
    vec3 simple = mix(ink, white, .6) * core + ink * exp(-d * .55) * .32;

    // Close up: a sphere's surface, darker at the limb, its cells churning slowly.
    float mu = sqrt(max(1. - d * d, 0.));
    vec3 p = vec3(q, mu) + vec3(seed, seed * .7, time * .06);
    float cells = fbm(p * 4.5);
    float spots = giant ? smoothstep(.35, .8, snoise(p * 1.3)) * .3 : 0.;
    float grain = calm ? .12 : .3;
    vec3 surface = mix(ink, white, (giant ? .08 : .35) * mu)
      * (.35 + .65 * pow(mu, .55)) * (1. - grain * .5 + grain * cells) * (1. - spots);
    float inside = 1. - smoothstep(1. - aa, 1. + aa, d);

    // The corona: streamers that drift outward, widest round a giant.
    float angle = atan(q.y, q.x);
    float reach = giant ? 1.5 : calm ? 2.8 : 2.1;
    float streamers = .65 + .35 * snoise(vec3(cos(angle) * 2., sin(angle) * 2., d * .6 - time * .12 + seed));
    float corona = d > 1. ? exp(-(d - 1.) * reach) * streamers * (calm ? .3 : .45) : 0.;

    // A giant's flares: bright arcs lifting off the limb, more often the longer it is blocked.
    float flare = 0.;
    if (giant) {
      float lift = snoise(vec3(cos(angle) * 1.8, sin(angle) * 1.8, time * .2 + seed));
      float height = 1.18 + .25 * (.5 + .5 * sin(time * .4 + angle * 3. + seed));
      flare = smoothstep(.6 - activity * .3, .9, lift) * exp(-abs(d - height) * 5.) * activity * 1.8;
    }

    // Faint diffraction spikes, for the clear stars only.
    float spikes = (exp(-abs(q.y) * 7.) * exp(-abs(q.x) * .55) + exp(-abs(q.x) * 7.) * exp(-abs(q.y) * .55))
      * (type < .5 ? .18 : .05);

    vec3 detailed = surface * inside + ink * (corona + flare) + mix(ink, white, .4) * spikes;

    // An unsettled merge hides in a drifting veil of its own gas.
    if (veiled) {
      float fog = smoothstep(.35, .85, fbm(vec3(q * .35, time * .03 + seed)) * .5 + .5);
      detailed = detailed * (1. - fog * .5) + ink * fog * exp(-d * .5) * .3;
    }

    vec3 colour = mix(simple, detailed, detail) * edge * opacity;
    gl_FragColor = vec4(colour, 1.);
  }`;
