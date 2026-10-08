import type { Box, Point } from './board-layout.ts';
import {
  fitViewport,
  panBy,
  revealBox,
  transformOf,
  zoomAt,
  type Size,
  type Viewport,
} from './viewport.ts';

const FIT_MARGIN = 28;
const REVEAL_MARGIN = 40;
const ZOOM_STEP = 1.25;
const WHEEL_SENSITIVITY = 0.0015;
const WHEEL_LINE_PIXELS = 16;
const KEY_PAN_PIXELS = 80;
const DRAG_THRESHOLD = 4;

/** Lets a board be dragged, zoomed and brought back into view inside its frame. */
export interface Camera {
  /** Shows a newly drawn board, fitted whole in the frame or kept where the last one was. */
  show(world: HTMLElement, board: Size, placement: 'fit' | 'keep'): void;
  fit(): void;
  zoomBy(factor: number): void;
  reveal(box: Box): void;
  destroy(): void;
}

export const ZOOM_IN = ZOOM_STEP;
export const ZOOM_OUT = 1 / ZOOM_STEP;

function frameSize(frame: HTMLElement): Size {
  return { width: frame.clientWidth, height: frame.clientHeight };
}

function frameCentre(frame: HTMLElement): Point {
  return { x: frame.clientWidth / 2, y: frame.clientHeight / 2 };
}

export function createCamera(frame: HTMLElement): Camera {
  let world: HTMLElement | null = null;
  let board: Size = { width: 0, height: 0 };
  let viewport: Viewport = { x: 0, y: 0, scale: 1 };

  const move = (next: Viewport): void => {
    viewport = next;
    if (world) world.style.transform = transformOf(viewport);
  };
  const fit = (): void => move(fitViewport(board, frameSize(frame), FIT_MARGIN));
  const zoomBy = (factor: number): void => move(zoomAt(viewport, factor, frameCentre(frame)));

  const onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const lines = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? WHEEL_LINE_PIXELS : 1;
    const rect = frame.getBoundingClientRect();
    const focus = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    move(zoomAt(viewport, Math.exp(-event.deltaY * lines * WHEEL_SENSITIVITY), focus));
  };

  let drag: { pointer: number; x: number; y: number; moved: boolean } | null = null;
  const swallowClick = (event: Event): void => event.stopPropagation();

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    drag = { pointer: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  };
  const onPointerMove = (event: PointerEvent): void => {
    if (!drag || drag.pointer !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!drag.moved) {
      drag.moved = true;
      frame.setPointerCapture(event.pointerId);
      frame.classList.add('is-dragging');
    }
    drag = { ...drag, x: event.clientX, y: event.clientY };
    move(panBy(viewport, dx, dy));
  };
  const onPointerEnd = (event: PointerEvent): void => {
    if (!drag || drag.pointer !== event.pointerId) return;
    if (drag.moved) {
      frame.classList.remove('is-dragging');
      frame.addEventListener('click', swallowClick, { capture: true, once: true });
      setTimeout(() => frame.removeEventListener('click', swallowClick, { capture: true }), 0);
    }
    drag = null;
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const arrows: Record<string, [number, number]> = {
      ArrowLeft: [KEY_PAN_PIXELS, 0],
      ArrowRight: [-KEY_PAN_PIXELS, 0],
      ArrowUp: [0, KEY_PAN_PIXELS],
      ArrowDown: [0, -KEY_PAN_PIXELS],
    };
    const pan = event.target === frame ? arrows[event.key] : undefined;
    if (pan) move(panBy(viewport, pan[0], pan[1]));
    else if (event.key === '+' || event.key === '=') zoomBy(ZOOM_IN);
    else if (event.key === '-' || event.key === '_') zoomBy(ZOOM_OUT);
    else if (event.key === '0') fit();
    else return;
    event.preventDefault();
  };

  let fitWhenShown = false;
  const observer = new ResizeObserver(() => {
    if (fitWhenShown && frame.clientWidth > 0) {
      fitWhenShown = false;
      fit();
    }
  });
  observer.observe(frame);

  frame.addEventListener('wheel', onWheel, { passive: false });
  frame.addEventListener('pointerdown', onPointerDown);
  frame.addEventListener('pointermove', onPointerMove);
  frame.addEventListener('pointerup', onPointerEnd);
  frame.addEventListener('pointercancel', onPointerEnd);
  frame.addEventListener('keydown', onKeyDown);

  return {
    show(next, size, placement) {
      world?.remove();
      world = next;
      board = size;
      world.style.transformOrigin = '0 0';
      frame.append(world);
      fitWhenShown = placement === 'fit' && frame.clientWidth === 0;
      if (placement === 'fit' && !fitWhenShown) fit();
      else move(viewport);
    },
    fit,
    zoomBy,
    reveal: (box) => move(revealBox(viewport, box, frameSize(frame), REVEAL_MARGIN)),
    destroy() {
      observer.disconnect();
      frame.removeEventListener('wheel', onWheel);
      frame.removeEventListener('pointerdown', onPointerDown);
      frame.removeEventListener('pointermove', onPointerMove);
      frame.removeEventListener('pointerup', onPointerEnd);
      frame.removeEventListener('pointercancel', onPointerEnd);
      frame.removeEventListener('keydown', onKeyDown);
    },
  };
}
