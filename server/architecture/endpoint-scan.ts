import ts from 'typescript';
import type { ScannedEndpoint } from './scanned-source.ts';
import { allIn } from './syntax-walk.ts';
import { type TextPart, textPartsOf } from './text-parts.ts';

/** The key of a route table, such as Observatory's `{ get: { '/api/x': handler } }`, and the verb it answers. */
const VERB_OF_TABLE_KEY: ReadonlyMap<string, string> = new Map([
  ['get', 'GET'],
  ['guardedGet', 'GET'],
  ['post', 'POST'],
  ['put', 'PUT'],
  ['patch', 'PATCH'],
  ['delete', 'DELETE'],
]);

/** The methods an Express-style router registers a route with. */
const ROUTER_VERBS: readonly string[] = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
];

/**
 * The names a router is given: `app`, `router`, `apiRouter`. A bare `get(path, x)`
 * on any other object, such as a cache or a client, is not a route.
 */
const ROUTER_NAME = /^(app|router|server|api|routes)$|(App|Router|Routes)$/;

const nameOf = (node: ts.Node): string | undefined => {
  const isPropertyName = ts.isPropertyAccessExpression(node.parent) && node.parent.name === node;
  return ts.isIdentifier(node) && !isPropertyName ? node.text : undefined;
};

/** The identifiers the nodes refer to, leaving out the property names after a dot. */
const referencedNames = (...nodes: readonly ts.Node[]): string[] =>
  [...new Set(nodes.flatMap((node) => allIn(node, nameOf)))].sort();

function keyParts(name: ts.PropertyName): TextPart[] | null {
  if (ts.isComputedPropertyName(name)) return textPartsOf(name.expression);
  return ts.isStringLiteralLike(name) ? [name.text] : null;
}

/** The routes one table entry such as `get: { ... }` holds. */
function tableRoutes(method: string, table: ts.ObjectLiteralExpression): ScannedEndpoint[] {
  return table.properties.flatMap((entry): ScannedEndpoint[] => {
    if (!ts.isPropertyAssignment(entry) && !ts.isMethodDeclaration(entry)) return [];
    const path = keyParts(entry.name);
    const handler = ts.isPropertyAssignment(entry) ? entry.initializer : entry;
    return path ? [{ method, path, handlers: referencedNames(handler) }] : [];
  });
}

function tableEndpoints(node: ts.Node): ScannedEndpoint[] {
  if (!ts.isPropertyAssignment(node) || !ts.isIdentifier(node.name)) return [];
  const method = VERB_OF_TABLE_KEY.get(node.name.text);
  return method && ts.isObjectLiteralExpression(node.initializer)
    ? tableRoutes(method, node.initializer)
    : [];
}

function routerName(receiver: ts.Expression): string | null {
  if (ts.isIdentifier(receiver)) return receiver.text;
  return ts.isPropertyAccessExpression(receiver) ? receiver.name.text : null;
}

/** `app.get('/x', handler)`: a router verb, a path, and at least one handler. */
function routerEndpoints(node: ts.Node): ScannedEndpoint[] {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return [];
  const [path, ...handlers] = node.arguments;
  const verb = node.expression.name.text;
  const receiver = routerName(node.expression.expression);
  const isRouter = receiver !== null && ROUTER_NAME.test(receiver);
  if (!path || handlers.length === 0 || !ROUTER_VERBS.includes(verb) || !isRouter) return [];
  return [
    { method: verb.toUpperCase(), path: textPartsOf(path), handlers: referencedNames(...handlers) },
  ];
}

/**
 * Every route a file registers: the entries of a route table, and the calls of
 * an Express-style router. Whether a path really is one, by starting with a
 * slash, is for the project to decide once constants are looked up.
 */
export function endpointsIn(source: ts.SourceFile): ScannedEndpoint[] {
  return allIn(source, (node) => {
    const found = [...tableEndpoints(node), ...routerEndpoints(node)];
    return found.length > 0 ? found : undefined;
  }).flat();
}
