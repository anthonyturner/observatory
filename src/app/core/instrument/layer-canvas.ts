/** A canvas that fills its host, which the core's host positions. */
export function layerCanvas(host: HTMLElement): HTMLCanvasElement {
  const canvas = host.ownerDocument.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  host.append(canvas);
  return canvas;
}
