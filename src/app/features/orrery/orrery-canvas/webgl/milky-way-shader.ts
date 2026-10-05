import { SIMPLEX_GLSL } from '../../../../shared/gl/simplex-glsl';

/* The Milky Way behind the Orrery: a full-screen layer drawn before anything
   else, so it is always the farthest thing in the sky. It is scenery, kept
   dim and under the bloom threshold so the worlds stay the subject. */

/** Drawn straight to clip space at the far plane: no camera, no culling. */
export const MILKY_WAY_VERTEX = `varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 1., 1.); }`;

/** A tilted band of glow that wanders, warmer and fuller at its core, split by
 *  dark dust lanes, over a haze of faint unresolved stars densest in the band.
 *  `turn` turns the whole sky; `drift` and `zoom` give it a little parallax. */
export const MILKY_WAY_FRAGMENT = `${SIMPLEX_GLSL}
  // Glow and dust are soft, so three octaves do: it runs on every pixel.
  float haze(vec3 p) { float s = 0., a = .5;
    for (int i = 0; i < 3; i++) { s += a * snoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= .5; }
    return s; }
  varying vec2 vUv;
  uniform float time, aspect, zoom, turn;
  uniform vec2 drift;
  void main() {
    vec2 p = (vUv - .5) * vec2(aspect, 1.) / zoom + drift;
    float c = cos(turn), s = sin(turn);
    p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);

    vec2 along = normalize(vec2(1., .38)), across = vec2(-along.y, along.x);
    // Off the centre, so the busiest part of the system sits on darker sky.
    float u = dot(p, along), v = dot(p, across) + .24;
    v += haze(vec3(u * 1.3, 0., 7.)) * .09;
    float width = .17 + .05 * haze(vec3(u * 2., 3., 1.));
    float band = exp(-v * v / (width * width));
    float core = exp(-(u - .25) * (u - .25) * 1.8);

    float clouds = .55 + .45 * haze(vec3(p * 4., 11.));
    float lanes = smoothstep(.05, .5, haze(vec3(p * 6.5, 2.))) * exp(-v * v / (width * width * .22));
    float glow = band * clouds * (.55 + .9 * core) * (1. - lanes * .8);
    vec3 tint = mix(vec3(.42, .52, .86), vec3(1., .8, .58), core * band);

    // Unresolved stars: one chance per tiny cell, far likelier inside the band.
    vec2 grid = p * 240.;
    vec2 cell = floor(grid);
    float pick = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
    vec2 nudge = vec2(fract(pick * 17.31), fract(pick * 41.77)) - .5;
    float dot_ = smoothstep(.3, 0., length(fract(grid) - .5 - nudge * .5));
    float star = step(1. - (.016 + .09 * band), pick) * dot_;
    float twinkle = .6 + .4 * sin(time * (.8 + pick * 2.6) + pick * 60.);

    vec3 colour = tint * glow * .09 + vec3(.82, .88, 1.) * star * twinkle * (.09 + .2 * band);
    gl_FragColor = vec4(colour, 1.);
  }`;
