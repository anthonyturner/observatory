import type { EdgeKind, InjectionStyle } from './architecture-types.ts';

/** The decorators that make a class one Angular creates, and so one that can inject. */
export const ANGULAR_DECORATORS = ['Injectable', 'Component', 'Directive', 'Pipe'] as const;
export type AngularDecorator = (typeof ANGULAR_DECORATORS)[number];

/** What declared a node: an Angular decorator, or one of the non-class shapes the scanner maps. */
export type DeclarationSort = AngularDecorator | 'InjectionToken' | 'function' | 'providers';

/** One name a declaration depends on, before it is resolved to a node. */
export interface ScannedReference {
  readonly target: string;
  readonly kind: EdgeKind;
  readonly how: InjectionStyle | null;
  readonly members: readonly string[];
}

/** One class, token, function or provider list, as its source file declares it. */
export interface ScannedDeclaration {
  readonly name: string;
  readonly sort: DeclarationSort;
  readonly providedIn: string | null;
  readonly references: readonly ScannedReference[];
  /** The element a component's selector matches, such as `app-dial`; null for none. */
  readonly element: string | null;
  readonly templateUrl: string | null;
  /** Custom element tags in the inline template, and in `templateUrl` once it has been read. */
  readonly tags: readonly string[];
}

/** `import { imported as local } from 'module'`. */
export interface ScannedImport {
  readonly local: string;
  readonly imported: string;
  readonly module: string;
}

/** A `{ provide: token, useClass: target }`: injecting `token` hands out `target`. */
export interface ScannedBinding {
  readonly token: string;
  readonly target: string;
}

/** A class a route shows: `module` is the `import()` it is loaded from, null when it is imported. */
export interface RouteTarget {
  readonly name: string;
  readonly module: string | null;
}

/** One route: the component it shows, or the module its child routes are loaded from. */
export interface ScannedRoute {
  readonly path: string;
  readonly component: RouteTarget | null;
  readonly children: string | null;
}

/** A `case '<label>':` that navigates to `path`, as an app switching on its window name does. */
export interface CaseRoute {
  readonly label: string;
  readonly path: string;
}

/** Everything the scanner reads from one TypeScript source file. */
export interface ScannedSource {
  readonly declarations: readonly ScannedDeclaration[];
  readonly imports: readonly ScannedImport[];
  readonly bindings: readonly ScannedBinding[];
  readonly routes: readonly ScannedRoute[];
  readonly caseRoutes: readonly CaseRoute[];
}

/** One scanned source file, by its path relative to the project root. */
export interface ScannedFile extends ScannedSource {
  readonly file: string;
}
