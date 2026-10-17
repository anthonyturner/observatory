import {
  AdditiveBlending,
  BackSide,
  Color,
  Mesh,
  MeshBasicMaterial,
  PointLight,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { SunPlacement } from '../../../../core/orrery/sun-placement';
import { SPHERE_VERTEX } from '../../../../shared/planets/planet-shaders';
import { Owned, vec } from '../../../starmap/engine/gpu-kit';
import { CORONA_FRAGMENT } from './orrery-shaders';

/** Just bright enough that the bloom catches the sun's rim, and no more. */
const SUN_OVERBRIGHT = 1.3;
/** How far the corona reaches, in sun radii. */
const CORONA_REACH = 1.9;

/** The sun's parts, all at `position`: the light every shader is lit from, the body, and the corona round it. */
export interface SunBody {
  readonly position: Vector3;
  readonly light: PointLight;
  readonly body: Mesh;
  readonly corona: Mesh;
  readonly coronaMaterial: ShaderMaterial;
}

/** Puts the sun into `scene` where `placement` says: overbright so the bloom takes it, with its marched corona. */
export function buildSun(
  scene: Scene,
  placement: SunPlacement,
  bodyColour: Color,
  geometry: SphereGeometry,
  owned: Owned,
): SunBody {
  const position = vec(placement.x, placement.y, placement.z);
  const light = new PointLight('#fff2dd', 1);
  light.position.copy(position);
  const body = new Mesh(
    geometry,
    owned.own(new MeshBasicMaterial({ color: bodyColour.multiplyScalar(SUN_OVERBRIGHT) })),
  );
  body.scale.setScalar(placement.radius);
  body.position.copy(position);
  const coronaMaterial = owned.own(
    new ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        centre: { value: position },
        radius: { value: placement.radius },
        reach: { value: CORONA_REACH },
      },
      vertexShader: SPHERE_VERTEX,
      fragmentShader: CORONA_FRAGMENT,
      transparent: true,
      side: BackSide,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  );
  const corona = new Mesh(
    owned.own(new SphereGeometry(placement.radius * CORONA_REACH, 32, 20)),
    coronaMaterial,
  );
  corona.position.copy(position);
  scene.add(light, body, corona);
  return { position, light, body, corona, coronaMaterial };
}
