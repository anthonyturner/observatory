/* The Earth's shaders, a sibling of the worlds' own in shared/planets, which
   the Architecture page shares and which stay as they are. The ground, the
   cloud shell and the air are lit from the one sun like every other world, but
   their colour comes from NASA's pictures rather than from noise. */

/** Samples an equirectangular map by direction. A map's own seam makes the
 *  texture coordinate jump from 1 to 0, and the hardware would read that jump
 *  as a very distant surface and draw a thin line; so the derivatives come from
 *  whichever of two seam placements is smooth here. */
const MAP = `const float TAU = 6.2831853;
  vec2 mapUv(vec3 n) { return vec2(fract(atan(n.z, -n.x) / TAU), .5 + asin(clamp(n.y, -1., 1.)) / 3.1415927); }
  vec4 sampleMap(sampler2D map, vec3 n) {
    vec2 uv = mapUv(n), shifted = vec2(fract(uv.x + .5) - .5, uv.y);
    vec2 dx = dFdx(uv), dy = dFdy(uv), sx = dFdx(shifted), sy = dFdy(shifted);
    bool useShifted = dot(sx, sx) + dot(sy, sy) < dot(dx, dx) + dot(dy, dy);
    return textureGrad(map, uv, useShifted ? sx : dx, useShifted ? sy : dy); }
  vec3 turnY(vec3 v, float a) { float c = cos(a), s = sin(a);
    return vec3(c * v.x + s * v.z, v.y, c * v.z - s * v.x); }`;

/** How much of the sky a point of the cloud map covers. */
const CLOUDS = `uniform sampler2D cloudMap;
  float cloudCover(vec3 n) { return smoothstep(.15, .9, sampleMap(cloudMap, n).r); }`;

/** The ground: the day map where the sun shines and, past a soft terminator, the
 *  city lights of the night map. Dusk warms the band between, cloud shadows fall
 *  on the ground, and the sea glints. The lights stay under the bloom threshold
 *  (0.85) at about 0.55 of it, so only the sun and a few pinpricks glow. */
export const EARTH_GROUND_FRAGMENT = `${MAP} ${CLOUDS}
  uniform mat4 modelMatrix;
  uniform sampler2D dayMap, nightMap;
  uniform vec3 sun;
  uniform float cloudTurn;
  varying vec3 wp; varying vec3 wn; varying vec3 local;
  void main() {
    vec3 n = normalize(local);
    vec3 G = normalize(wn), L = normalize(sun - wp), V = normalize(cameraPosition - wp);
    float sunward = dot(G, L);
    vec3 ground = sampleMap(dayMap, n).rgb;
    float wet = smoothstep(1.15, 1.6, ground.b / max(ground.r, .002)) * step(ground.g * .9, ground.b);
    ground *= 1. + wet * 1.2;

    vec3 sunLocal = normalize(transpose(mat3(modelMatrix)) * L);
    float cloud = cloudCover(turnY(n, cloudTurn));
    float shadowed = cloudCover(turnY(normalize(n + sunLocal * .02), cloudTurn));

    float lit = smoothstep(-.08, .12, sunward);
    float diffuse = lit * (.25 + .9 * pow(clamp(sunward, 0., 1.), .7));
    float dusk = smoothstep(-.05, .1, sunward) * (1. - smoothstep(.1, .45, sunward));
    vec3 sunlight = mix(vec3(1., .97, .92), vec3(1., .58, .36), dusk * .25);
    vec3 colour = ground * (.02 + diffuse * (1. - shadowed * .5) * sunlight);

    float night = 1. - smoothstep(-.12, .08, sunward);
    float town = smoothstep(.02, .3, dot(sampleMap(nightMap, n).rgb, vec3(.3, .6, .1)));
    colour += vec3(1., .72, .38) * town * .47 * night * (1. - cloud * .7);

    float glint = pow(max(dot(reflect(-L, G), V), 0.), 120.) * .3 * wet * lit * (1. - cloud);
    colour += vec3(1., .95, .85) * glint;
    gl_FragColor = vec4(colour, 1.);
  }`;

/** The cloud shell: white tops lit by the sun and reddening at the terminator.
 *  Held under 0.8 so they never cross the bloom threshold. They fade out with
 *  the light rather than turning dark, which would blot out the ground and its
 *  lights; the ground dims its own lights under cloud. */
export const EARTH_CLOUD_FRAGMENT = `${MAP} ${CLOUDS}
  uniform vec3 sun;
  varying vec3 wp; varying vec3 wn; varying vec3 local;
  void main() {
    float cover = cloudCover(normalize(local));
    if (cover < .01) discard;
    float sunward = dot(normalize(wn), normalize(sun - wp));
    float day = smoothstep(-.1, .35, sunward);
    float dusk = smoothstep(-.05, .1, sunward) * (1. - smoothstep(.1, .45, sunward));
    vec3 colour = mix(vec3(1.), vec3(1., .6, .4), dusk * .6) * (.015 + day * 1.05);
    gl_FragColor = vec4(min(colour, vec3(.8)), cover * .9 * day);
  }`;
