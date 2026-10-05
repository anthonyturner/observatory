/* The orrery's 3D shaders, as pr-starmap wrote them. Lighting is analytic from
   the one sun: shadows are ray/plane and ray/sphere tests rather than shadow
   maps, which would cost six renders a frame on a laptop. */

export const SPHERE_VERTEX = `varying vec3 wp; varying vec3 wn; varying vec3 local;
  void main() { local = position; vec4 p = modelMatrix * vec4(position,1.);
    wp = p.xyz; wn = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * p; }`;

const NOISE = `float noise3(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  vec3 a = vec3(17.1,113.5,27.7);
  float n = dot(i,a);
  return mix(mix(mix(fract(sin(n)*43758.5),fract(sin(n+a.x)*43758.5),f.x),
    mix(fract(sin(n+a.y)*43758.5),fract(sin(n+a.x+a.y)*43758.5),f.x),f.y),
    mix(mix(fract(sin(n+a.z)*43758.5),fract(sin(n+a.x+a.z)*43758.5),f.x),
    mix(fract(sin(n+a.y+a.z)*43758.5),fract(sin(n+a.x+a.y+a.z)*43758.5),f.x),f.y),f.z); }`;

/** A world or moon: noisy land and bands in its colour, lit from the sun, shadowed
 *  by its own ring or, for a moon, by the world it circles. A dim night side
 *  keeps the severity hue. */
export const SURFACE_FRAGMENT = `${NOISE}
  varying vec3 wp; varying vec3 wn; varying vec3 local;
  uniform vec3 ink, sun, centre, ringNormal, parentCentre;
  uniform float seed, radius, hasRing, isMoon, parentRadius;
  void main() {
    vec3 N = normalize(wn), L = normalize(sun-wp), V = normalize(cameraPosition-wp);
    float land = noise3(local*4. + seed) * .6 + noise3(local*11. + seed)*.28 + noise3(local*28. + seed)*.12;
    float bands = sin(local.y * 25. + land * 9. + seed) * .025;
    vec3 albedo = ink * (.72 + land * .42 + bands);
    float day = max(dot(N,L),0.);
    float shadow = 1.;
    if (hasRing > .5) {
      float denom = dot(L,ringNormal);
      float hit = -dot(wp-centre,ringNormal) / (abs(denom) < .0001 ? .0001 : denom);
      float r = length(wp + L*hit - centre) / max(radius,.001);
      float band = smoothstep(1.72,1.82,r) * (1.-smoothstep(2.24,2.34,r));
      if (hit > 0.) shadow *= 1. - band*.32;
    }
    if (isMoon > .5) {
      vec3 toParent = parentCentre - wp;
      float ahead = dot(toParent,L);
      float miss = length(toParent - L*ahead);
      if (ahead > 0.) shadow *= smoothstep(parentRadius*.92,parentRadius*1.08,miss);
    }
    vec3 colour = albedo * (.055 + day * shadow * 1.32);
    float spec = pow(max(dot(reflect(-L,N),V),0.),28.) * day * .13 * shadow;
    gl_FragColor = vec4(colour + vec3(spec),1.);
  }`;

/** A thin shell of air, brightest at the limb on the day side. */
export const ATMOSPHERE_FRAGMENT = `varying vec3 wp; varying vec3 wn; uniform vec3 ink, sun;
  void main() { vec3 N = normalize(wn), V = normalize(cameraPosition-wp);
    float fresnel = pow(1. - max(dot(N,V),0.),3.5);
    float day = .12 + .88 * max(dot(N,normalize(sun-wp)),0.);
    gl_FragColor = vec4(ink * 1.7, fresnel * day * .62); }`;

/** The sun's corona, marched through in twelve steps, with slowly moving wisps.
 *  It reaches `reach` sun radii, and fades fast so the space round the sun stays dark. */
export const CORONA_FRAGMENT = `${NOISE} varying vec3 wp; uniform float time, radius, reach;
  void main() {
    vec3 ray = normalize(wp-cameraPosition); float b = dot(cameraPosition,ray);
    float d = b*b-dot(cameraPosition,cameraPosition)+radius*radius*reach*reach;
    if (d < 0.) discard;
    float start = max(0.,-b-sqrt(d)), finish = -b+sqrt(d);
    float stepSize = (finish-start)/12., sum = 0.;
    for (int i=0; i<12; i++) {
      vec3 p = cameraPosition + ray*(start+(float(i)+.5)*stepSize);
      float altitude = max(0.,length(p)/radius-1.);
      vec3 direction = normalize(p);
      float wisps = .55 + .45 * noise3(direction*9. + vec3(time*.07));
      sum += exp(-altitude*6.) * wisps * stepSize/radius;
    }
    gl_FragColor = vec4(vec3(1.,.62,.3), min(.3,sum*.14));
  }`;

export const RING_VERTEX = `varying vec3 p; void main() { p = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`;

/** A banded ring with a gap, for branches that no longer merge. */
export const RING_FRAGMENT = `varying vec3 p; uniform vec3 ink; void main() {
  float r = length(p.xy); if(r > 2.02 && r < 2.12) discard;
  float bands = .62 + .2 * sin(r*120.); gl_FragColor = vec4(ink*bands,1.); }`;

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
