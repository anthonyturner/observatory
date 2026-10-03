import { Injectable } from '@angular/core';
import { StoredLevel } from './stored-level';

const STORAGE_KEY = 'observatory.music.beat-strength';
/** The hit at full strength is the sky's intended look; the slider only softens it. */
export const DEFAULT_BEAT_STRENGTH = 1;

/** How hard each beat hits the sky, from 0 (no hit) to 1 (full): the flash
 *  round the core, the ring, the glowing edges and the zoom together. */
@Injectable({ providedIn: 'root' })
export class BeatStrength extends StoredLevel {
  constructor() {
    super(STORAGE_KEY, DEFAULT_BEAT_STRENGTH);
  }
}
