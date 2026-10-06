import { InjectionToken } from '@angular/core';
import { AskedHow } from './reply-entry';

/** Carries out words a shortcut matched, typed or spoken. */
export type ShortcutAct = (how: AskedHow) => void;

/** Words Home acts on itself, with no router or model, typed or spoken alike. */
export interface AskShortcut {
  /** What `words` would do here, or null to leave them to the router. */
  actOf(words: string): ShortcutAct | null;
  /** A request went to the router instead, so nothing still waits on an answer here. */
  passOver(): void;
}

/** Every shortcut, asked in turn before a request goes to the router. Each is
 *  provided with `multi: true`, so a new one never edits another. */
export const ASK_SHORTCUTS = new InjectionToken<readonly AskShortcut[]>('ASK_SHORTCUTS');
