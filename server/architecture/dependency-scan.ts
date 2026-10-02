import ts from 'typescript';
import type { InjectionStyle } from './architecture-types.ts';
import type { ScannedReference } from './scanned-source.ts';
import { allIn, firstIn } from './syntax-walk.ts';

const INJECT_FUNCTION = 'inject';

/** A dependency before its members are known; `field` is the `this.` name it is kept under. */
interface Request {
  readonly target: string;
  readonly how: InjectionStyle;
  readonly field: string | null;
}

const injects = (target: string, how: InjectionStyle, members: string[]): ScannedReference => ({
  target,
  kind: 'injects',
  how,
  members,
});

/** What a class asks Angular for, through its constructor and `inject()`, with the members it reads. */
export function classInjections(node: ts.ClassDeclaration): ScannedReference[] {
  const requests = [...constructorRequests(node), ...injectRequests(node)];
  const used = membersByField(node);
  return requests.map(({ target, how, field }) =>
    injects(target, how, field === null ? [] : [...(used.get(field) ?? [])].sort()),
  );
}

/** The `inject()` calls anywhere inside `node`, such as a token's factory or a plain function. */
export function nestedInjections(node: ts.Node): ScannedReference[] {
  return injectRequests(node).map(({ target }) => injects(target, 'inject', []));
}

/** The class `node` extends, as a reference; none when it extends nothing it names plainly. */
export function extendsOf(node: ts.ClassDeclaration): ScannedReference[] {
  const clause = node.heritageClauses?.find(({ token }) => token === ts.SyntaxKind.ExtendsKeyword);
  const parent = clause?.types[0]?.expression;
  return parent && ts.isIdentifier(parent)
    ? [{ target: parent.text, kind: 'extends', how: null, members: [] }]
    : [];
}

const isInjectCall = (node: ts.Node): boolean =>
  ts.isCallExpression(node) && node.expression.getText() === INJECT_FUNCTION;

/** Whether `inject()` is called anywhere inside `node`. */
export const callsInject = (node: ts.Node): boolean =>
  firstIn(node, (child) => (isInjectCall(child) ? true : undefined)) ?? false;

const calledNameOf = (node: ts.Node): string | undefined =>
  ts.isCallExpression(node) && ts.isIdentifier(node.expression) && !isInjectCall(node)
    ? node.expression.text
    : undefined;

/** Each function `node` calls by name, once; only the ones mapped as nodes become edges. */
export function callsOf(node: ts.Node): ScannedReference[] {
  const called = new Set(allIn(node, calledNameOf));
  return [...called].map((target) => ({ target, kind: 'calls', how: null, members: [] }));
}

function constructorRequests(node: ts.ClassDeclaration): Request[] {
  const parameters = node.members.find(ts.isConstructorDeclaration)?.parameters ?? [];
  return parameters.flatMap((parameter) => {
    const { type, name } = parameter;
    if (!type || !ts.isTypeReferenceNode(type) || !ts.isIdentifier(type.typeName)) return [];
    // Only a parameter with a modifier (`private x: X`) becomes a field members are read through.
    const isField = Boolean(ts.getModifiers(parameter)?.length) && ts.isIdentifier(name);
    return [{ target: type.typeName.text, how: 'constructor', field: isField ? name.text : null }];
  });
}

function injectRequestOf(node: ts.Node): Request | undefined {
  if (!ts.isCallExpression(node) || !isInjectCall(node)) return undefined;
  const [token] = node.arguments;
  return token && ts.isIdentifier(token)
    ? { target: token.text, how: 'inject', field: fieldHolding(node) }
    : undefined;
}

const injectRequests = (node: ts.Node): Request[] => allIn(node, injectRequestOf);

const isWrapper = (node: ts.Node): boolean =>
  ts.isAsExpression(node) || ts.isNonNullExpression(node) || ts.isParenthesizedExpression(node);

/** The class field an `inject()` call initialises, seen through `as X`, `!` and brackets. */
function fieldHolding(call: ts.Node): string | null {
  let holder = call.parent;
  while (isWrapper(holder)) holder = holder.parent;
  return ts.isPropertyDeclaration(holder) && ts.isIdentifier(holder.name) ? holder.name.text : null;
}

const isThisField = (node: ts.Node): node is ts.PropertyAccessExpression =>
  ts.isPropertyAccessExpression(node) && node.expression.kind === ts.SyntaxKind.ThisKeyword;

/** For each `this.<field>.<member>` in the class, the members read from that field. */
function membersByField(node: ts.ClassDeclaration): Map<string, Set<string>> {
  const used = new Map<string, Set<string>>();
  const visit = (child: ts.Node): void => {
    if (ts.isPropertyAccessExpression(child) && isThisField(child.expression)) {
      const field = child.expression.name.text;
      used.set(field, (used.get(field) ?? new Set<string>()).add(child.name.text));
    }
    ts.forEachChild(child, visit);
  };
  ts.forEachChild(node, visit);
  return used;
}
