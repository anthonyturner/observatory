/* The worlds' own shaders: procedural surfaces of four kinds, relief lit from
   the one sun, and a shell of air in the severity colour. Everything is
   computed per pixel from noise, so no textures load and every repo's world is
   its own. */

import { WORLD_KINDS, WorldKind } from '../../core/orrery/world-kind';
import { SIMPLEX_GLSL } from '../gl/simplex-glsl';

/** How far a world's own surface takes its severity colour; its air carries the rest. */
export const WORLD_TINT = 0.14;
/** The air shell's radius, in world radii; the layout spaces worlds by it too. */
export { AIR_SCALE } from '../../core/orrery/world-layout';
/** The cloud shell sits just above the ground. */
export const CLOUD_SCALE = 1.015;

/** The defines a surface or cloud material compiles its kind with. */
export const kindDefines = (kind: WorldKind): { KIND: number } => ({
  KIND: WORLD_KINDS.indexOf(kind),
});

export const SPHERE_VERTEX = `varying vec3 wp; varying vec3 wn; varying vec3 local;
  void main() { local = position; vec4 p = modelMatrix * vec4(position,1.);
    wp = p.xyz; wn = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * p; }`;

/* The kinds, numbered as WORLD_KINDS orders them: rocky, gas, ice, desert.
   Each gives a height, for relief, and a colour; `vary` picks a palette
   within the kind, so two rocky worlds need not look alike. The kind is fixed
   when the program compiles: a driver can take twenty seconds over all four
   kinds in one program, and a few seconds over one. */
const KINDS = `const float kind = float(KIND); uniform float seed;
  vec3 offset() { return vec3(seed * .137, seed * .071, seed * .193); }
  float vary() { return fract(seed * .6180339); }
  float rockyLand(vec3 p) { vec3 s = offset();
    vec3 warp = vec3(fbm(p * 1.4 + s), fbm(p * 1.4 + s + 5.2), fbm(p * 1.4 + s + 9.7)) * .35;
    return fbm(p * 1.8 + warp + s) + .16 * ridged(p * 6. + s) - .12; }
  float craters(vec3 p) { vec3 cell = floor(p), f = fract(p); float h = 0.;
    for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
      vec3 o = vec3(float(x), float(y), float(z)); vec3 r = hash3(cell + o);
      if (r.y < .45) continue;
      float k = length(f - o - r) / (.18 + .22 * r.x);
      h += (k < 1. ? (k * k - 1.) * .5 : 0.) + exp(-pow((k - 1.) * 5., 2.)) * .2; }
    return h; }
  float iceCracks(vec3 p) { vec3 s = offset();
    return 1. - smoothstep(0., .09, abs(snoise(p * 4.5 + s) + .3 * snoise(p * 11. + s))); }
  float height(vec3 p) {
    if (kind < .5) return max(rockyLand(p), 0.);
    if (kind < 1.5) return 0.;
    if (kind < 2.5) return fbm(p * 2. + offset()) * .25 - iceCracks(p) * .03;
    return fbm(p * 2.5 + offset()) * .25 + fbm(p * 12. + offset()) * .05
      + craters(p * 3.2 + offset()) * .3 + craters(p * 8.3 + offset()) * .12; }
  vec3 rockyColour(vec3 p, out float wet) { float h = rockyLand(p); wet = step(h, 0.);
    float lush = step(.4, vary());
    vec3 deep = mix(vec3(.01, .05, .12), vec3(.02, .07, .1), lush);
    vec3 shallow = mix(vec3(.04, .2, .3), vec3(.05, .24, .26), lush);
    vec3 low = mix(vec3(.42, .34, .2), vec3(.12, .26, .09), lush);
    vec3 high = mix(vec3(.5, .4, .3), vec3(.36, .3, .2), lush);
    vec3 c = h < 0. ? mix(deep, shallow, smoothstep(-.35, 0., h))
      : mix(mix(low, high, smoothstep(.05, .35, h)), vec3(.92), smoothstep(.42, .55, h));
    float cap = abs(p.y) + fbm(p * 3. + offset()) * .12;
    return mix(c, vec3(.93, .96, 1.), smoothstep(.8, .86, cap)); }
  vec3 gasColour(vec3 p) { vec3 s = offset();
    vec3 q = p + vec3(fbm(p * 3. + s), 0., fbm(p * 3. + s + 4.1)) * .12;
    float eddies = fbm(vec3(q.x * 3., q.y * 14., q.z * 3.) + s);
    float t = q.y + eddies * .06 + fbm(q * 9. + s) * .015;
    float cool = step(.55, vary());
    vec3 c1 = mix(vec3(.86, .76, .58), vec3(.62, .76, .92), cool);
    vec3 c2 = mix(vec3(.6, .4, .25), vec3(.2, .36, .68), cool);
    vec3 c3 = mix(vec3(.45, .22, .13), vec3(.88, .93, .98), cool);
    float band = sin(t * 19. + seed) + .55 * sin(t * 43. + seed * 1.3) + .3 * sin(t * 97.);
    vec3 c = mix(c1, c2, smoothstep(-.9, .9, band));
    c = mix(c, c3, smoothstep(.6, 1.4, band) * .7);
    c *= .9 + eddies * .2;
    float a = seed * 2.4; vec3 eye = normalize(vec3(cos(a), -.32, sin(a)));
    float storm = 1. - smoothstep(.07, .16, length((p - eye) * vec3(1., 2.3, 1.)) + snoise(p * 14.) * .02);
    return mix(c, mix(vec3(.62, .25, .15), vec3(.95), cool), storm * .85); }
  vec3 iceColour(vec3 p) { float b = fbm(p * 2. + offset());
    vec3 c = mix(vec3(.46, .6, .76), vec3(.74, .82, .9), smoothstep(-.4, .4, b));
    return mix(c, vec3(.4, .58, .78), iceCracks(p) * .45); }
  vec3 desertColour(vec3 p) { float b = fbm(p * 2.5 + offset());
    float rust = step(.5, vary());
    vec3 light = mix(vec3(.5, .46, .4), vec3(.72, .48, .29), rust);
    vec3 dark = mix(vec3(.32, .31, .3), vec3(.46, .27, .16), rust);
    float grain = fbm(p * 14. + offset()) * .18;
    return mix(dark, light, clamp(smoothstep(-.5, .5, b) * .8 + grain + craters(p * 3.2 + offset()) * .3, 0., 1.)); }
  vec3 surfaceColour(vec3 p, out float wet) { wet = 0.;
    if (kind < .5) return rockyColour(p, wet);
    if (kind < 1.5) return gasColour(p);
    if (kind < 2.5) return iceColour(p);
    return desertColour(p); }`;

/* Cloud cover, shared by the cloud shell and the ground it shades. Stretched
   along latitude into belts, and warped so the belts break into weather. */
const CLOUDS = `uniform float cloudCover;
  float cloudAt(vec3 p) { vec3 s = offset() + 31.;
    vec3 q = vec3(p.x, p.y * 1.8, p.z);
    q += vec3(fbm(q * 1.6 + s), 0., fbm(q * 1.6 + s + 7.3)) * .4;
    float v = fbm(q * 2.4 + s) * .5 + .5 + fbm(q * 9. + s) * .08;
    return smoothstep(1. - cloudCover, 1.18 - cloudCover, v); }
  vec3 turnY(vec3 v, float a) { float c = cos(a), s = sin(a);
    return vec3(c * v.x + s * v.z, v.y, c * v.z - s * v.x); }`;

/** A world or moon: a surface of its kind with its relief lit from the sun,
 *  shadowed by its own ring or, for a moon, by the world it circles. Severity
 *  tints the surface by `tint` and hazes the limb; the air shell carries the rest. */
export const SURFACE_FRAGMENT = `${SIMPLEX_GLSL} ${KINDS} ${CLOUDS}
  uniform mat4 modelMatrix;
  varying vec3 wp; varying vec3 wn; varying vec3 local;
  uniform vec3 ink, sun, centre, ringNormal, parentCentre;
  uniform float radius, hasRing, isMoon, parentRadius, tint, cloudTurn, lights, unrest, time;
  void main() {
    // Relief: tilt the normal down the height's slope, measured a step either way.
    vec3 n = normalize(local);
    vec3 t1 = normalize(cross(abs(n.y) < .99 ? vec3(0., 1., 0.) : vec3(1., 0., 0.), n));
    vec3 t2 = cross(n, t1);
    const float E = .004;
    float h0 = height(n);
    vec3 slope = t1 * (height(normalize(n + t1 * E)) - h0) + t2 * (height(normalize(n + t2 * E)) - h0);
    vec3 N = normalize(mat3(modelMatrix) * normalize(n - slope / E * .05));
    vec3 G = normalize(wn), L = normalize(sun - wp), V = normalize(cameraPosition - wp);
    float wet;
    vec3 albedo = surfaceColour(n, wet);
    float luma = dot(albedo, vec3(.299, .587, .114));
    albedo = mix(albedo, ink * luma * 1.5, tint);
    float sunward = dot(G, L);
    float day = max(dot(N, L), 0.) * smoothstep(-.05, .12, sunward);
    // Deep air scatters light round a gas giant, so its terminator is soft.
    if (kind > .5 && kind < 1.5) day = smoothstep(-.15, .65, sunward) * .9;
    float shadow = 1.;
    if (hasRing > .5) {
      float denom = dot(L, ringNormal);
      float hit = -dot(wp - centre, ringNormal) / (abs(denom) < .0001 ? .0001 : denom);
      float r = length(wp + L * hit - centre) / max(radius, .001);
      float band = smoothstep(1.72, 1.82, r) * (1. - smoothstep(2.24, 2.34, r));
      if (hit > 0.) shadow *= 1. - band * .32;
    }
    if (isMoon > .5) {
      vec3 toParent = parentCentre - wp;
      float ahead = dot(toParent, L);
      float miss = length(toParent - L * ahead);
      if (ahead > 0.) shadow *= smoothstep(parentRadius * .92, parentRadius * 1.08, miss);
    }
    float overcast = 0.;
    if (cloudCover > 0.) {
      vec3 sunLocal = normalize(transpose(mat3(modelMatrix)) * L);
      overcast = cloudAt(turnY(normalize(n + sunLocal * .03), cloudTurn));
      shadow *= 1. - overcast * .55;
    }
    // Sunlight reddens where it grazes the air, along the terminator.
    float dusk = smoothstep(-.05, .1, sunward) * (1. - smoothstep(.1, .45, sunward));
    vec3 light = mix(vec3(1., .97, .92), vec3(1., .58, .36), dusk * .7);
    vec3 colour = albedo * (.03 + day * shadow * 1.05 * light) + ink * .012;
    // Water and ice shine; rock and cloud tops barely do.
    float gloss = mix(.04, .55, wet) + (kind > 1.5 && kind < 2.5 ? .15 : 0.);
    float sharp = mix(18., 70., wet);
    colour += vec3(1., .95, .85) * pow(max(dot(reflect(-L, N), V), 0.), sharp) * gloss * day * shadow;
    float limb = pow(1. - max(dot(G, V), 0.), 4.) * smoothstep(-.2, .4, sunward);
    colour += ink * limb * .35 * (1. - isMoon);
    float night = 1. - smoothstep(-.12, .08, sunward);
    vec3 off = offset();
    if (lights > 0. && (kind < .5 || kind > 1.5)) {
      float region = smoothstep(.52, .7, fbm(n * 2.2 + off + 13.) * .5 + .5 - (1. - lights) * .2);
      float towns = pow(max(snoise(n * 45. + off), 0.), 4.) * 3. + pow(max(snoise(n * 110. + off), 0.), 6.) * 2.;
      float cover = cloudCover > 0. ? cloudAt(turnY(n, cloudTurn)) : 0.;
      colour += vec3(1., .72, .38) * towns * region * (1. - wet) * lights * night * (1. - cover * .7) * 1.4;
    }
    if (unrest > 0.) {
      float flicker = .8 + .2 * sin(time * 1.7 + n.x * 9. + n.z * 7.);
      float glow;
      if (kind > .5 && kind < 1.5) glow = smoothstep(.62, .85, fbm(vec3(n.x * 3., n.y * 10., n.z * 3.) + off) * .5 + .5) * .6;
      else glow = 1. - smoothstep(0., .025, abs(snoise(n * 3. + off + 5.) + .25 * snoise(n * 9. + off)));
      colour += vec3(1., .34, .08) * glow * unrest * flicker * (.15 + .85 * night) * 1.6;
    }
    gl_FragColor = vec4(colour, 1.);
  }`;

/** The cloud shell: white tops lit by the sun, reddening at the terminator,
 *  turning at their own speed over the ground. */
export const CLOUD_FRAGMENT = `${SIMPLEX_GLSL} ${KINDS} ${CLOUDS}
  varying vec3 wp; varying vec3 wn; varying vec3 local; uniform vec3 sun;
  void main() {
    float cover = cloudAt(normalize(local));
    if (cover < .01) discard;
    float sunward = dot(normalize(wn), normalize(sun - wp));
    float day = smoothstep(-.1, .35, sunward);
    float dusk = smoothstep(-.05, .1, sunward) * (1. - smoothstep(.1, .45, sunward));
    vec3 colour = mix(vec3(1.), vec3(1., .6, .4), dusk * .6) * (.015 + day * 1.05);
    gl_FragColor = vec4(colour, cover * .88); }`;

/** A shell of air in the severity colour: densest just above the ground,
 *  thinning with altitude, lit on the day side and warming to sunset along
 *  the terminator. Altitude is where the view ray passes closest to the world. */
export const ATMOSPHERE_FRAGMENT = `uniform mat4 modelMatrix;
  varying vec3 wp; uniform vec3 ink, sun; uniform float ground;
  void main() {
    vec3 centre = modelMatrix[3].xyz;
    float shell = length(modelMatrix[0].xyz), solid = shell * ground;
    vec3 ray = normalize(wp - cameraPosition), toCentre = centre - cameraPosition;
    vec3 nearest = cameraPosition + ray * dot(toCentre, ray);
    float reach = length(nearest - centre);
    float altitude = clamp((reach - solid) / (shell - solid), 0., 1.);
    float density = reach < solid ? pow(reach / solid, 8.) * .55 : exp(-altitude * 4.) * (1. - altitude);
    float sunward = dot(normalize(nearest - centre), normalize(sun - centre));
    float day = smoothstep(-.35, .45, sunward);
    float dusk = smoothstep(-.3, 0., sunward) * (1. - smoothstep(0., .35, sunward));
    vec3 colour = mix(ink * 1.5, vec3(1., .55, .3) * 1.3, dusk * .5);
    gl_FragColor = vec4(colour, density * (.06 + .94 * day) * .85); }`;
