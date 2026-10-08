import { DepthModule, Verdict } from '../depth.types';

const PRINCIPLE_OF: Record<Verdict, string> = {
  deep: 'deep-modules',
  balanced: 'deep-modules',
  shallow: 'shallow-modules',
};

/** A module as the API reports it, with depth and verdict worked out from the two sizes. */
export function depthModule(
  file: string,
  implementation: number,
  interfaceSize: number,
): DepthModule {
  const depth = implementation / Math.max(interfaceSize, 1);
  const verdict: Verdict =
    depth >= 8 ? 'deep' : depth < 1 && interfaceSize >= 2 ? 'shallow' : 'balanced';
  const slash = file.lastIndexOf('/');
  return {
    file,
    folder: slash === -1 ? '' : file.slice(0, slash),
    implementation,
    interfaceSize,
    depth,
    verdict,
    principle: PRINCIPLE_OF[verdict],
  };
}
