import ts from 'typescript';
import { namesIn, optionOf } from './decorator-scan.ts';
import type { ScannedBinding, ScannedReference } from './scanned-source.ts';

const PROVIDE = 'provide';
/** The keys of a provider object that name what injecting its token hands out. */
const BINDING_KEYS = ['useClass', 'useExisting', 'useFactory'] as const;
const DEPS = 'deps';

/** What a `providers` array names: each entry its holder provides, and each token-to-target binding. */
export interface ProviderScan {
  readonly references: readonly ScannedReference[];
  readonly bindings: readonly ScannedBinding[];
}

const NO_PROVIDERS: ProviderScan = { references: [], bindings: [] };

const provides = (target: string): ScannedReference => ({
  target,
  kind: 'provides',
  how: null,
  members: [],
});

const nameOf = (value: ts.Expression | null): string | null =>
  value && ts.isIdentifier(value) ? value.text : null;

/** Whether an element is a `{ provide: ... }` object, the shape only a provider list holds. */
export const isProviderObject = (element: ts.Node): boolean =>
  ts.isObjectLiteralExpression(element) && optionOf(element, PROVIDE) !== null;

/** `{ provide: T, useClass: C, deps: [D] }`: the holder provides T and C, and T hands out C and D. */
function scanProviderObject(entry: ts.ObjectLiteralExpression): ProviderScan {
  const token = nameOf(optionOf(entry, PROVIDE));
  const targets = [
    ...BINDING_KEYS.flatMap((key) => nameOf(optionOf(entry, key)) ?? []),
    ...namesIn(optionOf(entry, DEPS)),
  ];
  return {
    references: [...(token ? [token] : []), ...targets].map(provides),
    bindings: token ? targets.map((target) => ({ token, target })) : [],
  };
}

function scanEntry(entry: ts.Expression): ProviderScan {
  if (ts.isSpreadElement(entry)) return scanEntry(entry.expression);
  if (ts.isIdentifier(entry)) return { references: [provides(entry.text)], bindings: [] };
  if (ts.isObjectLiteralExpression(entry)) return scanProviderObject(entry);
  return ts.isArrayLiteralExpression(entry) ? providersIn(entry) : NO_PROVIDERS;
}

/** What a `providers` array provides; nothing for anything that is not an array literal. */
export function providersIn(list: ts.Expression | null): ProviderScan {
  if (!list || !ts.isArrayLiteralExpression(list)) return NO_PROVIDERS;
  const scans = list.elements.map(scanEntry);
  return {
    references: scans.flatMap((scan) => scan.references),
    bindings: scans.flatMap((scan) => scan.bindings),
  };
}
