/* The orrery's 3D shaders, as pr-starmap wrote them. Lighting is analytic from
   the one sun: shadows are ray/plane and ray/sphere tests rather than shadow
   maps, which would cost six renders a frame on a laptop. */

export const RING_VERTEX = `varying vec3 p; varying vec3 wp; void main() { p = position;
  vec4 w = modelMatrix * vec4(position, 1.); wp = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w; }`;

/** A ring for branches that no longer merge: many thin translucent bands and a
 *  gap, in the severity colour mixed with dust, brighter when the sun is behind
 *  it, and dark where the world's shadow falls across it. */
export const RING_FRAGMENT = `uniform mat4 modelMatrix;
  varying vec3 p; varying vec3 wp; uniform vec3 ink, sun; uniform float seed;
  float hash1(float x) { return fract(sin(x * 127.1 + seed) * 43758.5453); }
  float noise1(float x) { float i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
    return mix(hash1(i), hash1(i + 1.), f); }
  void main() {
    float r = length(p.xy), t = (r - 1.76) / (2.3 - 1.76);
    float density = (.12 + .88 * pow(noise1(r * 40.), 1.6)) * (.55 + .45 * noise1(r * 170.))
      * smoothstep(0., .06, t) * (1. - smoothstep(.88, 1., t))
      * smoothstep(.0, .015, abs(r - 2.07) - .045);
    vec3 centre = modelMatrix[3].xyz; float planet = length(modelMatrix[0].xyz);
    vec3 L = normalize(sun - wp), V = normalize(cameraPosition - wp), toCentre = centre - wp;
    float ahead = dot(toCentre, L);
    float lit = ahead > 0. ? smoothstep(planet * .97, planet * 1.03, length(toCentre - L * ahead)) : 1.;
    float backlit = pow(max(dot(-V, L), 0.), 4.);
    vec3 dust = mix(vec3(.78, .7, .6), ink, .55);
    gl_FragColor = vec4(dust * (.06 + lit * (.9 + backlit * 1.2)), density * .7); }`;

export const FIELD_VERTEX = `attribute vec3 color; attribute float size; attribute vec2 phase;
  uniform float time; uniform float pixelRatio; varying vec3 ink;
  void main() { float tw = .62 + .38 * sin(time * phase.y + phase.x);
    ink = color * tw; vec4 p = modelViewMatrix * vec4(position,1.);
    gl_Position = projectionMatrix * p; gl_PointSize = (1. + size * 2.) * pixelRatio; }`;

export const FIELD_FRAGMENT = `varying vec3 ink; void main() { float r = length(gl_PointCoord - .5) * 2.;
  if (r > 1.) discard; gl_FragColor = vec4(ink, (1. - smoothstep(.1,1.,r))); }`;

export const FINISH_VERTEX =
  'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }';

/** Vignette and film grain, after the bloom. */
export const FINISH_FRAGMENT = `uniform sampler2D tDiffuse; uniform float time; varying vec2 vUv;
  void main() { vec3 c = texture2D(tDiffuse,vUv).rgb;
    float vignette = 1. - .72 * smoothstep(.2,.8,length(vUv-.5));
    float grain = fract(sin(dot(gl_FragCoord.xy + floor(time*24.),vec2(12.9898,78.233)))*43758.5453)-.5;
    gl_FragColor = vec4(max(vec3(0.),c*vignette+grain*.018),1.); }`;
