import { Injectable } from '@angular/core';
import { StoredLevel } from '../stored-level';

const STORAGE_KEY = 'observatory.music.milkdrop-opacity';
/** Milkdrop fills the screen, screened over the sky; a touch under full keeps
 *  the beat hits standing out over it. */
export const DEFAULT_MILKDROP_OPACITY = 0.8;

/** How strongly Milkdrop shows over the sky, from 0 (hidden) to 1 (full). */
@Injectable({ providedIn: 'root' })
export class MilkdropOpacity extends StoredLevel {
  constructor() {
    super(STORAGE_KEY, DEFAULT_MILKDROP_OPACITY);
  }
}
