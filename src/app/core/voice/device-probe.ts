import { DOCUMENT, InjectionToken, inject } from '@angular/core';
import { PathKey } from './model-paths';

/** The few WebGPU members the probe reads; the DOM types may not carry them. */
interface GpuAdapterLike {
  readonly features: { has(feature: string): boolean };
  readonly isFallbackAdapter?: boolean;
  readonly info?: { readonly isFallbackAdapter?: boolean };
}

interface GpuLike {
  requestAdapter(): Promise<GpuAdapterLike | null>;
}

/** Chooses where the models run: the graphics card if there is a real one,
 *  else the processor. */
export const DEVICE_PROBE = new InjectionToken<() => Promise<PathKey>>('DeviceProbe', {
  providedIn: 'root',
  factory: () => {
    const navigator = inject(DOCUMENT).defaultView?.navigator;
    return () => choosePath(gpuOf(navigator));
  },
});

/** A software stand-in (a "fallback" adapter) would be slower than the
 *  processor path, so it counts as none. */
export async function choosePath(gpu: GpuLike | null): Promise<PathKey> {
  try {
    const adapter = await gpu?.requestAdapter();
    const isFallback = adapter?.info?.isFallbackAdapter ?? adapter?.isFallbackAdapter;
    if (adapter && !isFallback) return adapter.features.has('shader-f16') ? 'gpu' : 'gpu32';
  } catch {
    // No WebGPU in this browser: the processor it is.
  }
  return 'cpu';
}

function gpuOf(navigator: Navigator | undefined): GpuLike | null {
  const gpu: unknown = navigator && 'gpu' in navigator ? navigator.gpu : null;
  return typeof gpu === 'object' && gpu !== null && 'requestAdapter' in gpu
    ? (gpu as GpuLike)
    : null;
}
