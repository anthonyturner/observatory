import { circuitView } from './circuit/circuit-view.ts';
import type { MapView } from './view.ts';

/** The tabs, in order. A new view is one module that exports a `MapView` and one line here. */
export const VIEWS: readonly MapView[] = [circuitView];
