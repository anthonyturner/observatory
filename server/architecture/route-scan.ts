import ts from 'typescript';
import { optionOf, textOption } from './decorator-scan.ts';
import type { CaseRoute, RouteTarget, ScannedRoute } from './scanned-source.ts';
import { allIn, firstIn } from './syntax-walk.ts';

const NAVIGATE_METHODS: readonly string[] = ['navigate', 'navigateByUrl'];
const THEN = 'then';
const LEADING_SLASHES = /^\/+/;

/** The module an `import('...')` loads. */
function dynamicImportOf(node: ts.Node): string | undefined {
  if (!ts.isCallExpression(node) || node.expression.kind !== ts.SyntaxKind.ImportKeyword) {
    return undefined;
  }
  const [module] = node.arguments;
  return module && ts.isStringLiteralLike(module) ? module.text : undefined;
}

/** The export a `.then(m => m.Name)` picks from a loaded module. */
function pickedExportOf(node: ts.Node): string | undefined {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) {
    return undefined;
  }
  const [pick] = node.arguments;
  if (node.expression.name.text !== THEN || !pick || !ts.isArrowFunction(pick)) return undefined;
  return ts.isPropertyAccessExpression(pick.body) ? pick.body.name.text : undefined;
}

/** `() => import('./dial').then(m => m.DialComponent)`, as the class and the module it comes from. */
function lazyTargetOf(loader: ts.Expression): RouteTarget | null {
  const module = firstIn(loader, dynamicImportOf);
  const name = firstIn(loader, pickedExportOf);
  return module && name ? { name, module } : null;
}

/** The value of each top-level `const`, by name, so a loader a route names can be looked up. */
function topLevelValues(source: ts.SourceFile): Map<string, ts.Expression> {
  const values = new Map<string, ts.Expression>();
  for (const statement of source.statements.filter(ts.isVariableStatement)) {
    for (const { name, initializer } of statement.declarationList.declarations) {
      if (ts.isIdentifier(name) && initializer) values.set(name.text, initializer);
    }
  }
  return values;
}

/** A loader written in the route, or named there and defined at the top of the file. */
function loaderOf(
  loader: ts.Expression,
  values: ReadonlyMap<string, ts.Expression>,
): ts.Expression {
  return (ts.isIdentifier(loader) ? values.get(loader.text) : undefined) ?? loader;
}

function targetOf(
  route: ts.ObjectLiteralExpression,
  values: ReadonlyMap<string, ts.Expression>,
): RouteTarget | null {
  const component = optionOf(route, 'component');
  if (component && ts.isIdentifier(component)) return { name: component.text, module: null };
  const loader = optionOf(route, 'loadComponent');
  return loader ? lazyTargetOf(loaderOf(loader, values)) : null;
}

/** A route's path, or null for one a `matcher` function decides. */
function pathOf(route: ts.ObjectLiteralExpression): string | null | undefined {
  const path = textOption(route, 'path');
  if (path !== null) return path;
  return optionOf(route, 'matcher') === null ? undefined : null;
}

function routeOf(
  node: ts.Node,
  values: ReadonlyMap<string, ts.Expression>,
): ScannedRoute | undefined {
  if (!ts.isObjectLiteralExpression(node)) return undefined;
  const path = pathOf(node);
  if (path === undefined) return undefined;
  const component = targetOf(node, values);
  const loader = optionOf(node, 'loadChildren');
  const children = loader ? (firstIn(loader, dynamicImportOf) ?? null) : null;
  return component || children ? { path, component, children } : undefined;
}

/** Every route in a file that shows a component or loads child routes. */
export function routesIn(source: ts.SourceFile): ScannedRoute[] {
  const values = topLevelValues(source);
  return allIn(source, (node) => routeOf(node, values));
}

/** The path a `navigate(['/path'])` or `navigateByUrl('/path')` call goes to. */
function navigatedPathOf(node: ts.Node): string | undefined {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) {
    return undefined;
  }
  if (!NAVIGATE_METHODS.includes(node.expression.name.text)) return undefined;
  const [first] = node.arguments;
  const target = first && ts.isArrayLiteralExpression(first) ? first.elements[0] : first;
  return target && ts.isStringLiteralLike(target)
    ? target.text.replace(LEADING_SLASHES, '')
    : undefined;
}

function caseRouteOf(node: ts.Node): CaseRoute | undefined {
  if (!ts.isCaseClause(node) || !ts.isStringLiteralLike(node.expression)) return undefined;
  const path = node.statements
    .map((statement) => firstIn(statement, navigatedPathOf))
    .find((found) => found !== undefined);
  return path === undefined ? undefined : { label: node.expression.text, path };
}

/** Every `case '<label>':` that navigates somewhere, as an app switching on its window name does. */
export const caseRoutesIn = (source: ts.SourceFile): CaseRoute[] => allIn(source, caseRouteOf);
