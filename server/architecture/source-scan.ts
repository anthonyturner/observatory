import ts from 'typescript';
import type { InjectionStyle } from './architecture-types.ts';

/** The decorators that make a class one Angular creates, and so one that can inject. */
const ANGULAR_DECORATORS = ['Injectable', 'Component', 'Directive', 'Pipe'] as const;
export type AngularDecorator = (typeof ANGULAR_DECORATORS)[number];

const INJECT_FUNCTION = 'inject';
const PROVIDED_IN = 'providedIn';

/** One dependency a class asks for, and the members of it the class reads through `this`. */
export interface ScannedInjection {
  readonly target: string;
  readonly how: InjectionStyle;
  readonly members: readonly string[];
}

/** One decorated class, as its source file declares it. */
export interface ScannedClass {
  readonly name: string;
  readonly decorator: AngularDecorator;
  readonly providedIn: string | null;
  readonly injections: readonly ScannedInjection[];
}

/** A dependency before its members are known; `field` is the `this.` name it is kept under. */
interface Request {
  readonly target: string;
  readonly how: InjectionStyle;
  readonly field: string | null;
}

interface Decoration {
  readonly decorator: AngularDecorator;
  readonly providedIn: string | null;
}

/** Every Angular class declared in one TypeScript source file. */
export function scanSource(fileName: string, text: string): ScannedClass[] {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  return source.statements.filter(ts.isClassDeclaration).flatMap((node) => {
    const decoration = decorationOf(node);
    if (!node.name || !decoration) return [];
    return [{ name: node.name.text, ...decoration, injections: injectionsOf(node) }];
  });
}

function decorationOf(node: ts.ClassDeclaration): Decoration | null {
  for (const { expression } of ts.getDecorators(node) ?? []) {
    if (!ts.isCallExpression(expression)) continue;
    const called = expression.expression.getText();
    const decorator = ANGULAR_DECORATORS.find((name) => name === called);
    if (decorator) return { decorator, providedIn: providedInOf(expression) };
  }
  return null;
}

function providedInOf(call: ts.CallExpression): string | null {
  const [options] = call.arguments;
  if (!options || !ts.isObjectLiteralExpression(options)) return null;
  for (const property of options.properties) {
    if (!ts.isPropertyAssignment(property) || property.name.getText() !== PROVIDED_IN) continue;
    return ts.isStringLiteralLike(property.initializer) ? property.initializer.text : null;
  }
  return null;
}

function injectionsOf(node: ts.ClassDeclaration): ScannedInjection[] {
  const requests = [...constructorRequests(node), ...injectRequests(node)];
  const used = membersByField(node);
  return requests.map(({ target, how, field }) => ({
    target,
    how,
    members: field === null ? [] : [...(used.get(field) ?? [])].sort(),
  }));
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

function injectRequests(node: ts.ClassDeclaration): Request[] {
  const requests: Request[] = [];
  const visit = (child: ts.Node): void => {
    const target = injectTargetOf(child);
    if (target) requests.push({ target, how: 'inject', field: fieldHolding(child) });
    ts.forEachChild(child, visit);
  };
  ts.forEachChild(node, visit);
  return requests;
}

function injectTargetOf(node: ts.Node): string | null {
  if (!ts.isCallExpression(node) || node.expression.getText() !== INJECT_FUNCTION) return null;
  const [token] = node.arguments;
  return token && ts.isIdentifier(token) ? token.text : null;
}

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
