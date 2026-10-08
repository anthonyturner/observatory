import ts from 'typescript';
import type { ArchitectureMember, MemberKind, Visibility } from './architecture-types.ts';

/** The call that initialises a field, by name, and the kind of member it makes. */
const KIND_OF_INITIALISER: ReadonlyMap<string, MemberKind> = new Map([
  ['signal', 'signal'],
  ['computed', 'signal'],
  ['linkedSignal', 'signal'],
  ['toSignal', 'signal'],
  ['input', 'input'],
  ['model', 'input'],
  ['output', 'output'],
  ['outputFromObservable', 'output'],
]);

const KIND_OF_DECORATOR: ReadonlyMap<string, MemberKind> = new Map([
  ['Input', 'input'],
  ['Output', 'output'],
]);

const VISIBILITY_OF_MODIFIER: ReadonlyMap<ts.SyntaxKind, Visibility> = new Map([
  [ts.SyntaxKind.PublicKeyword, 'public'],
  [ts.SyntaxKind.ProtectedKeyword, 'protected'],
  [ts.SyntaxKind.PrivateKeyword, 'private'],
]);

type Declared =
  | ts.MethodDeclaration
  | ts.PropertyDeclaration
  | ts.GetAccessorDeclaration
  | ts.SetAccessorDeclaration;

const isDeclared = (member: ts.ClassElement): member is Declared =>
  ts.isMethodDeclaration(member) ||
  ts.isPropertyDeclaration(member) ||
  ts.isGetAccessor(member) ||
  ts.isSetAccessor(member);

function visibilityOf(member: Declared | ts.ParameterDeclaration): Visibility {
  if (ts.isPrivateIdentifier(member.name)) return 'private';
  const listed = ts.getModifiers(member)?.map(({ kind }) => VISIBILITY_OF_MODIFIER.get(kind));
  return listed?.find((visibility) => visibility !== undefined) ?? 'public';
}

function nameOf(name: ts.PropertyName | ts.BindingName | undefined): string | null {
  if (!name) return null;
  return ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isPrivateIdentifier(name)
    ? name.text
    : null;
}

/** `signal(0)`, `input.required<T>()` and the like: the name the initialiser calls. */
function calledNameOf(initializer: ts.Expression | undefined): string | null {
  if (!initializer || !ts.isCallExpression(initializer)) return null;
  const callee = initializer.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  return ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)
    ? callee.expression.text
    : null;
}

function decoratedKindOf(member: ts.HasDecorators): MemberKind | null {
  for (const { expression } of ts.getDecorators(member) ?? []) {
    const called = ts.isCallExpression(expression) ? expression.expression : expression;
    const kind = ts.isIdentifier(called) ? KIND_OF_DECORATOR.get(called.text) : undefined;
    if (kind) return kind;
  }
  return null;
}

function kindOf(member: Declared): MemberKind {
  if (ts.isMethodDeclaration(member)) return 'method';
  if (!ts.isPropertyDeclaration(member)) return decoratedKindOf(member) ?? 'accessor';
  const initialiser = calledNameOf(member.initializer);
  const initialised = initialiser === null ? undefined : KIND_OF_INITIALISER.get(initialiser);
  return decoratedKindOf(member) ?? initialised ?? 'property';
}

const isParameterProperty = (parameter: ts.ParameterDeclaration): boolean =>
  Boolean(ts.getModifiers(parameter)?.length);

/** The constructor's `private readonly http: HttpClient` parameters, which declare fields. */
function parameterProperties(node: ts.ClassDeclaration): ArchitectureMember[] {
  const constructor = node.members.find(ts.isConstructorDeclaration);
  return (constructor?.parameters ?? []).filter(isParameterProperty).flatMap((parameter) => {
    const name = nameOf(parameter.name);
    return name === null
      ? []
      : [{ name, kind: 'property' as const, visibility: visibilityOf(parameter) }];
  });
}

/**
 * What a class holds, in the order it is written: its constructor's parameter
 * properties, then its fields, accessors and methods. A name an overload, or a
 * getter and setter, repeats is listed once.
 */
export function membersOf(node: ts.ClassDeclaration): ArchitectureMember[] {
  const declared = node.members.filter(isDeclared).flatMap((member): ArchitectureMember[] => {
    const name = nameOf(member.name);
    return name === null ? [] : [{ name, kind: kindOf(member), visibility: visibilityOf(member) }];
  });
  const seen = new Set<string>();
  return [...parameterProperties(node), ...declared].filter(({ name, kind }) => {
    const key = `${kind}:${name}`;
    return seen.has(key) ? false : Boolean(seen.add(key));
  });
}
