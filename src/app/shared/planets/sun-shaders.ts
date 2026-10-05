/** Just bright enough that the bloom catches the sun's rim, and no more. */
export const SUN_OVERBRIGHT = 1.3;
/** How far the corona reaches, in sun radii. */
export const CORONA_REACH = 1.9;

const NOISE = `float noise3(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  vec3 a = vec3(17.1,113.5,27.7);
  float n = dot(i,a);
  return mix(mix(mix(fract(sin(n)*43758.5),fract(sin(n+a.x)*43758.5),f.x),
    mix(fract(sin(n+a.y)*43758.5),fract(sin(n+a.x+a.y)*43758.5),f.x),f.y),
    mix(mix(fract(sin(n+a.z)*43758.5),fract(sin(n+a.x+a.z)*43758.5),f.x),
    mix(fract(sin(n+a.y+a.z)*43758.5),fract(sin(n+a.x+a.y+a.z)*43758.5),f.x),f.y),f.z); }`;

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
