import { Injectable, signal } from '@angular/core';
import { MERGE_METHODS, MergeMethod } from './edit-record';

const STORAGE_KEY = 'observatory.merge-method';
const DEFAULT_METHOD: MergeMethod = 'squash';

/** The merge method last picked in this browser; squash until one is. */
@Injectable({ providedIn: 'root' })
export class MergeMethodChoice {
  private readonly picked = signal<MergeMethod>(readStoredMethod());

  readonly chosen = this.picked.asReadonly();

  choose(method: MergeMethod): void {
    this.picked.set(method);
    storeMethod(method);
  }
}

/** Private windows and blocked site data throw here; squash then holds. */
function readStoredMethod(): MergeMethod {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return MERGE_METHODS.find((method) => method === stored) ?? DEFAULT_METHOD;
  } catch {
    return DEFAULT_METHOD;
  }
}

/** Where storage is blocked the choice lasts for this visit only, which is still useful. */
function storeMethod(method: MergeMethod): void {
  try {
    localStorage.setItem(STORAGE_KEY, method);
  } catch {
    return;
  }
}
