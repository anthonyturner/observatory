/** The parts of Butterchurn, the Milkdrop visualizer, the music layer uses; the
 *  package ships no types of its own. */
declare module 'butterchurn' {
  export interface ButterchurnVisualizer {
    connectAudio(node: AudioNode): void;
    disconnectAudio(node: AudioNode): void;
    loadPreset(preset: object, blendTimeS: number): void;
    setRendererSize(width: number, height: number): void;
    render(): void;
  }

  export interface ButterchurnOptions {
    readonly width: number;
    readonly height: number;
    readonly pixelRatio?: number;
    readonly textureRatio?: number;
  }

  const butterchurn: {
    createVisualizer(
      context: AudioContext,
      canvas: HTMLCanvasElement,
      options: ButterchurnOptions,
    ): ButterchurnVisualizer;
  };
  export default butterchurn;
}

declare module 'butterchurn-presets/lib/butterchurnPresets.min.js' {
  const presets: { getPresets(): Record<string, object> };
  export default presets;
}
