import { SIMPLEX_GLSL } from '../../../shared/gl/simplex-glsl';

/* The disc of gas round a pull request's star, and the planets for the issues
   it closes. Both lie in the same tilted plane, turned as the star turns. */

/** How flat the disc and the orbits look: the plane's tilt from face-on. */
export const SYSTEM_TILT = 0.34;
/** The disc's quad reaches this far past the disc's own reach, so its edge fades clear. */
export const DISC_QUAD_MARGIN = 1.05;

/* Every shader here draws all the stars' marks of one kind in a single call.
   What would be a uniform for one mark is an instance attribute, passed on to
   the fragment shader as a varying; `aPos` and `aSize` place and scale the
   mark's unit shape. */

/** The disc's per-instance values: `aKind` is (weight, seed), `aSpin` is
 *  (turn, inner, star) and `aFade` is (detail, opacity). */
export const DISC_VERTEX = `attribute vec3 aPos, aInk, aSpin;
  attribute vec2 aKind, aFade;
  attribute float aSize;
  varying vec2 vUv;
  varying vec3 ink;
  varying float weight, seed, turn, inner, star, detail, opacity;
  void main() {
    vUv = uv; ink = aInk;
    weight = aKind.x; seed = aKind.y;
    turn = aSpin.x; inner = aSpin.y; star = aSpin.z;
    detail = aFade.x; opacity = aFade.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position * aSize + aPos, 1.);
  }`;

/** A disc of gas that turns faster near the star, brighter on the side
 *  coming towards you, its far half passing behind the star. */
export const DISC_FRAGMENT = `${SIMPLEX_GLSL}
  varying vec2 vUv;
  varying vec3 ink;
  varying float turn, inner, star, weight, detail, opacity, seed;
  uniform float time;
  void main() {
    vec2 q = (vUv - .5) * 2. * ${DISC_QUAD_MARGIN.toFixed(2)};
    q.y = -q.y;
    float c = cos(turn), s = sin(turn);
    vec2 k = vec2(c * q.x + s * q.y, c * q.y - s * q.x);
    vec2 e = vec2(k.x, k.y / ${SYSTEM_TILT.toFixed(2)});
    float rr = length(e);
    float band = smoothstep(inner, inner + .15, rr) * (1. - smoothstep(.68, 1., rr));
    if (band <= 0.) discard;
    float angle = atan(e.y, e.x);
    float orbit = angle - time * .5 / max(rr, .2);
    float gas = .55 + .45 * snoise(vec3(cos(orbit) * 2.5, sin(orbit) * 2.5, rr * 5. + seed));
    float lanes = .88 + .12 * sin(rr * 38. + gas * 3.);
    float approaching = 1. + .5 * cos(angle);
    float behind = e.y < 0. ? 1. - (1. - smoothstep(star * .9, star * 1.1, length(q))) * .85 : 1.;
    vec3 hot = mix(ink, vec3(1., .95, .88), .35 * (1. - rr));
    vec3 colour = hot * band * mix(.8, gas * lanes, detail) * approaching * behind
      * (.18 + .27 * weight) * opacity;
    gl_FragColor = vec4(colour, 1.);
  }`;

/** A planet's per-instance values: its `aStar` is where the star it orbits is. */
export const PLANET_VERTEX = `attribute vec3 aPos, aTone, aStar;
  attribute float aSize, aOpacity;
  varying vec3 wp, wn, tone, star;
  varying float opacity;
  void main() {
    vec4 p = modelMatrix * vec4(position * aSize + aPos, 1.);
    wp = p.xyz; wn = normalize(mat3(modelMatrix) * normal);
    tone = aTone; star = aStar; opacity = aOpacity;
    gl_Position = projectionMatrix * viewMatrix * p;
  }`;

/** A small world lit by its own star: a day side towards it, a night side away. */
export const PLANET_FRAGMENT = `varying vec3 wp, wn, tone, star;
  varying float opacity;
  void main() {
    vec3 N = normalize(wn), L = normalize(star - wp), V = normalize(cameraPosition - wp);
    float day = max(dot(N, L), 0.);
    vec3 colour = tone * (.12 + day * 1.3) + tone * pow(1. - max(dot(N, V), 0.), 3.) * .3;
    gl_FragColor = vec4(colour, opacity);
  }`;

/** An urgent star's expanding ring: `aAlpha` fades it as it grows. */
export const PULSE_VERTEX = `attribute vec3 aPos, aInk;
  attribute float aSize, aAlpha;
  varying vec4 ring;
  void main() {
    ring = vec4(aInk, aAlpha);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position * aSize + aPos, 1.);
  }`;

export const PULSE_FRAGMENT = `varying vec4 ring;
  void main() { gl_FragColor = ring; }`;
