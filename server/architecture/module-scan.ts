import ts from 'typescript';
import type { ScannedConstant } from './scanned-source.ts';
import { allIn } from './syntax-walk.ts';
import { textPartsOf } from './text-parts.ts';

const DEFAULT_EXPORT = 'default';
const BOOTSTRAP_FUNCTIONS: readonly string[] = ['bootstrapApplication', 'bootstrapModule'];

const isExported = (node: ts.Node): boolean =>
  ts.canHaveModifiers(node) &&
  Boolean(ts.getModifiers(node)?.some(({ kind }) => kind === ts.SyntaxKind.ExportKeyword));

const isDefaultExport = (node: ts.Node): boolean =>
  ts.canHaveModifiers(node) &&
  Boolean(ts.getModifiers(node)?.some(({ kind }) => kind === ts.SyntaxKind.DefaultKeyword));

function exportedNames(statement: ts.Statement): string[] {
  if (ts.isExportAssignment(statement)) return statement.isExportEquals ? [] : [DEFAULT_EXPORT];
  if (ts.isExportDeclaration(statement)) {
    const clause = statement.exportClause;
    return clause && ts.isNamedExports(clause) ? clause.elements.map(({ name }) => name.text) : [];
  }
  if (!isExported(statement)) return [];
  if (isDefaultExport(statement)) return [DEFAULT_EXPORT];
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.flatMap(({ name }) =>
      ts.isIdentifier(name) ? [name.text] : [],
    );
  }
  const named =
    ts.isClassDeclaration(statement) ||
    ts.isFunctionDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement) ||
    ts.isEnumDeclaration(statement);
  return named && statement.name ? [statement.name.text] : [];
}

/** What a file exports by name, in the order it is written; `export *` is left out, as it names nothing. */
export const exportsIn = (source: ts.SourceFile): string[] => [
  ...new Set(source.statements.flatMap(exportedNames)),
];

function staticSpecifier(statement: ts.Statement): string | undefined {
  const isModuleStatement = ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement);
  const specifier = isModuleStatement ? statement.moduleSpecifier : undefined;
  return specifier && ts.isStringLiteral(specifier) ? specifier.text : undefined;
}

function dynamicSpecifier(node: ts.Node): string | undefined {
  if (!ts.isCallExpression(node) || node.expression.kind !== ts.SyntaxKind.ImportKeyword) {
    return undefined;
  }
  const [specifier] = node.arguments;
  return specifier && ts.isStringLiteralLike(specifier) ? specifier.text : undefined;
}

/** Every module a file imports, re-exports or loads with `import()`, as it writes the specifier, once. */
export function specifiersIn(source: ts.SourceFile): string[] {
  const found = [
    ...source.statements.flatMap((statement) => staticSpecifier(statement) ?? []),
    ...allIn(source, dynamicSpecifier),
  ];
  return [...new Set(found)];
}

/** The top-level `const` values that are text, or a name that may be: what a path or URL can be built from. */
export function constantsIn(source: ts.SourceFile): ScannedConstant[] {
  return source.statements.filter(ts.isVariableStatement).flatMap((statement) => {
    const isConst = Boolean(statement.declarationList.flags & ts.NodeFlags.Const);
    return statement.declarationList.declarations.flatMap(({ name, initializer }) => {
      if (!isConst || !ts.isIdentifier(name) || !initializer) return [];
      const parts = textPartsOf(initializer);
      const isText = parts.some((part) => typeof part === 'string' || part.name !== null);
      return isText ? [{ name: name.text, parts }] : [];
    });
  });
}

function bootstrappedNames(node: ts.Node): string[] | undefined {
  if (!ts.isCallExpression(node)) return undefined;
  const callee = ts.isPropertyAccessExpression(node.expression)
    ? node.expression.name
    : node.expression;
  if (!ts.isIdentifier(callee) || !BOOTSTRAP_FUNCTIONS.includes(callee.text)) return undefined;
  return node.arguments.flatMap((argument) => (ts.isIdentifier(argument) ? [argument.text] : []));
}

/** The names handed to `bootstrapApplication` or `bootstrapModule`: what Angular starts without anything injecting it. */
export const bootstrappedIn = (source: ts.SourceFile): string[] => [
  ...new Set(allIn(source, bootstrappedNames).flat()),
];
