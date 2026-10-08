import ts from 'typescript';

/** What a source file shows the code that imports it. */
export interface ExportedSurface {
  /** Names, parameters and members a caller has to learn. */
  readonly size: number;
  /** Whether anything exported exists at run time, rather than only as a type. */
  readonly hasValue: boolean;
}

const NO_SURFACE: ExportedSurface = { size: 0, hasValue: false };

const surface = (size: number, hasValue: boolean): ExportedSurface => ({ size, hasValue });

const add = (a: ExportedSurface, b: ExportedSurface): ExportedSurface =>
  surface(a.size + b.size, a.hasValue || b.hasValue);

const hasModifier = (node: ts.Node, kind: ts.SyntaxKind): boolean =>
  ts.canHaveModifiers(node) && (ts.getModifiers(node)?.some((m) => m.kind === kind) ?? false);

const isExported = (node: ts.Node): boolean => hasModifier(node, ts.SyntaxKind.ExportKeyword);

/** A member only the class itself (or its subclasses) can reach costs callers nothing. */
const isHidden = (member: ts.ClassElement): boolean =>
  hasModifier(member, ts.SyntaxKind.PrivateKeyword) ||
  hasModifier(member, ts.SyntaxKind.ProtectedKeyword) ||
  (member.name !== undefined && ts.isPrivateIdentifier(member.name));

/** The parameters of a function value, which a caller has to supply. */
function parametersOf(value: ts.Node | undefined): number {
  return value && (ts.isArrowFunction(value) || ts.isFunctionExpression(value))
    ? value.parameters.length
    : 0;
}

/** A class built by Angular's injector is never constructed by a caller, so its constructor costs them nothing. */
const isInjected = (node: ts.ClassDeclaration): boolean =>
  (ts.getDecorators(node)?.length ?? 0) > 0;

function classCost(node: ts.ClassDeclaration): number {
  const injected = isInjected(node);
  const seenAccessors = new Set<string>();
  let cost = 0;
  for (const member of node.members) {
    if (isHidden(member)) continue;
    if (ts.isConstructorDeclaration(member)) {
      cost += injected ? 0 : member.parameters.length;
    } else if (ts.isMethodDeclaration(member)) {
      cost += 1 + member.parameters.length;
    } else if (ts.isAccessor(member)) {
      const name = member.name.getText();
      if (!seenAccessors.has(name)) cost++;
      seenAccessors.add(name);
    } else if (ts.isPropertyDeclaration(member) || ts.isIndexSignatureDeclaration(member)) {
      cost++;
    }
  }
  return cost;
}

function shapeMemberCost(member: ts.TypeElement): number {
  const isCallable =
    ts.isMethodSignature(member) ||
    ts.isCallSignatureDeclaration(member) ||
    ts.isConstructSignatureDeclaration(member);
  return isCallable ? 1 + member.parameters.length : 1;
}

const shapeCost = (members: readonly ts.TypeElement[]): number =>
  members.reduce((total, member) => total + shapeMemberCost(member), 0);

function exportedStatement(node: ts.Statement): ExportedSurface {
  if (ts.isFunctionDeclaration(node)) return surface(1 + node.parameters.length, true);
  if (ts.isClassDeclaration(node)) return surface(1 + classCost(node), true);
  if (ts.isEnumDeclaration(node)) return surface(1 + node.members.length, true);
  if (ts.isInterfaceDeclaration(node)) return surface(1 + shapeCost(node.members), false);
  if (ts.isTypeAliasDeclaration(node)) {
    return surface(ts.isTypeLiteralNode(node.type) ? 1 + shapeCost(node.type.members) : 1, false);
  }
  if (ts.isVariableStatement(node)) {
    const size = node.declarationList.declarations.reduce(
      (sum, declaration) => sum + 1 + parametersOf(declaration.initializer),
      0,
    );
    return surface(size, true);
  }
  return surface(1, true);
}

/** Names a file declares only as types, which `export { Name }` then exports as types. */
const typeNamesIn = (source: ts.SourceFile): Set<string> =>
  new Set(
    source.statements
      .filter((s) => ts.isInterfaceDeclaration(s) || ts.isTypeAliasDeclaration(s))
      .map((s) => s.name.text),
  );

function exportListSurface(node: ts.ExportDeclaration, typeNames: Set<string>): ExportedSurface {
  const clause = node.exportClause;
  if (!clause || !ts.isNamedExports(clause)) return surface(1, !node.isTypeOnly);
  const isLocal = node.moduleSpecifier === undefined;
  const values = clause.elements.filter(
    (element) =>
      !node.isTypeOnly &&
      !element.isTypeOnly &&
      !(isLocal && typeNames.has((element.propertyName ?? element.name).text)),
  );
  return surface(clause.elements.length, values.length > 0);
}

/** The interface of a source file: everything another file has to learn to use it. */
export function exportedSurface(source: ts.SourceFile): ExportedSurface {
  const typeNames = typeNamesIn(source);
  return source.statements.reduce((total, node) => {
    if (ts.isExportDeclaration(node)) return add(total, exportListSurface(node, typeNames));
    if (ts.isExportAssignment(node)) {
      return add(total, surface(1 + parametersOf(node.expression), true));
    }
    return isExported(node) ? add(total, exportedStatement(node)) : total;
  }, NO_SURFACE);
}
