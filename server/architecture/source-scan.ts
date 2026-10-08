import ts from 'typescript';
import {
  callsInject,
  callsOf,
  classInjections,
  extendsOf,
  nestedInjections,
} from './dependency-scan.ts';
import { linesOfCode } from './lines-of-code.ts';
import { membersOf } from './member-scan.ts';
import { bootstrappedIn, constantsIn, exportsIn, specifiersIn } from './module-scan.ts';
import { endpointsIn } from './endpoint-scan.ts';
import { outboundIn } from './outbound-scan.ts';
import { decorationOf, namesIn, optionOf, textOption } from './decorator-scan.ts';
import { isProviderObject, providersIn, type ProviderScan } from './provider-scan.ts';
import { caseRoutesIn, routesIn } from './route-scan.ts';
import type {
  DeclarationSort,
  ScannedBinding,
  ScannedDeclaration,
  ScannedImport,
  ScannedReference,
  ScannedSource,
} from './scanned-source.ts';
import { elementOf, tagsIn } from './template-tags.ts';

const INJECTION_TOKEN = 'InjectionToken';
const PROVIDER_TYPE = 'Provider';
const PROVIDERS = 'providers';

/** A declaration and the token bindings its providers made. */
interface Found {
  readonly declaration: ScannedDeclaration;
  readonly bindings: readonly ScannedBinding[];
}

const uses = (target: string): ScannedReference => ({
  target,
  kind: 'uses',
  how: null,
  members: [],
});

function declarationOf(
  name: string,
  sort: DeclarationSort,
  references: readonly ScannedReference[],
  extra: Partial<ScannedDeclaration> = {},
): ScannedDeclaration {
  return {
    name,
    sort,
    providedIn: null,
    references,
    element: null,
    templateUrl: null,
    tags: [],
    members: [],
    ...extra,
  };
}

function classFound(node: ts.ClassDeclaration): Found | null {
  const decoration = decorationOf(node);
  if (!node.name || !decoration) return null;
  const { decorator, options } = decoration;
  const providers = providersIn(optionOf(options, PROVIDERS));
  const selector = textOption(options, 'selector');
  const template = textOption(options, 'template');
  const references = [
    ...classInjections(node),
    ...extendsOf(node),
    ...namesIn(optionOf(options, 'imports')).map(uses),
    ...providers.references,
    ...callsOf(node),
  ];
  const declaration = declarationOf(node.name.text, decorator, references, {
    providedIn: textOption(options, 'providedIn'),
    element: selector ? elementOf(selector) : null,
    templateUrl: textOption(options, 'templateUrl'),
    tags: template ? tagsIn(template) : [],
    members: membersOf(node),
  });
  return { declaration, bindings: providers.bindings };
}

const isTokenCreation = (value: ts.Expression): value is ts.NewExpression =>
  ts.isNewExpression(value) && value.expression.getText() === INJECTION_TOKEN;

const isFunctionValue = (value: ts.Expression): boolean =>
  ts.isArrowFunction(value) || ts.isFunctionExpression(value);

/** The provider array a top-level value holds: itself, or an app config's `providers`. */
function providerListOf(value: ts.Expression, type: ts.TypeNode | undefined): ts.Expression | null {
  if (ts.isObjectLiteralExpression(value)) return optionOf(value, PROVIDERS);
  if (!ts.isArrayLiteralExpression(value)) return null;
  const isTyped = type?.getText().includes(PROVIDER_TYPE) ?? false;
  return isTyped || value.elements.some(isProviderObject) ? value : null;
}

const fromProviders = (name: string, scan: ProviderScan): Found => ({
  declaration: declarationOf(name, 'providers', scan.references),
  bindings: scan.bindings,
});

/** `new InjectionToken(description, { providedIn, factory })`, with what its factory injects. */
function tokenFound(name: string, creation: ts.NewExpression): Found {
  const [, options] = creation.arguments ?? [];
  const providedIn =
    options && ts.isObjectLiteralExpression(options) ? textOption(options, 'providedIn') : null;
  const references = [...nestedInjections(creation), ...callsOf(creation)];
  return {
    declaration: declarationOf(name, 'InjectionToken', references, { providedIn }),
    bindings: [],
  };
}

/** An injection token, a function that calls `inject()`, or a provider list; null for anything else. */
function variableFound({ name, initializer, type }: ts.VariableDeclaration): Found | null {
  if (!ts.isIdentifier(name) || !initializer) return null;
  if (isTokenCreation(initializer)) return tokenFound(name.text, initializer);
  if (isFunctionValue(initializer) && callsInject(initializer)) {
    return { declaration: functionFound(name.text, initializer), bindings: [] };
  }
  const list = providerListOf(initializer, type);
  return list ? fromProviders(name.text, providersIn(list)) : null;
}

const functionFound = (name: string, body: ts.Node): ScannedDeclaration =>
  declarationOf(name, 'function', [...nestedInjections(body), ...callsOf(body)]);

function statementFound(statement: ts.Statement): Found[] {
  if (ts.isClassDeclaration(statement)) {
    const decorated = classFound(statement);
    return decorated ? [decorated] : [];
  }
  if (ts.isFunctionDeclaration(statement) && statement.name && callsInject(statement)) {
    return [{ declaration: functionFound(statement.name.text, statement), bindings: [] }];
  }
  if (!ts.isVariableStatement(statement)) return [];
  return statement.declarationList.declarations.flatMap(
    (variable) => variableFound(variable) ?? [],
  );
}

function importsOf(source: ts.SourceFile): ScannedImport[] {
  return source.statements
    .filter(ts.isImportDeclaration)
    .flatMap(({ moduleSpecifier, importClause }) => {
      const bindings = importClause?.namedBindings;
      if (!ts.isStringLiteral(moduleSpecifier) || !bindings || !ts.isNamedImports(bindings)) {
        return [];
      }
      return bindings.elements.map(({ name, propertyName }) => ({
        local: name.text,
        imported: propertyName?.getText() ?? name.text,
        module: moduleSpecifier.text,
      }));
    });
}

/** Names the declaration a node sits in, from the top-level statement that holds it; null outside every one. */
function ownerFinder(
  source: ts.SourceFile,
  foundBy: ReadonlyMap<ts.Node, readonly Found[]>,
): (node: ts.Node) => string | null {
  return (node) => {
    let statement = node;
    while (statement.parent !== source) statement = statement.parent;
    return foundBy.get(statement)?.[0]?.declaration.name ?? null;
  };
}

/** Everything the map needs from one TypeScript source file. */
export function scanSource(fileName: string, text: string): ScannedSource {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  const foundBy = new Map(
    source.statements.map((statement): [ts.Node, Found[]] => [
      statement,
      statementFound(statement),
    ]),
  );
  const founds = [...foundBy.values()].flat();
  return {
    declarations: founds.map(({ declaration }) => declaration),
    imports: importsOf(source),
    bindings: founds.flatMap(({ bindings }) => bindings),
    routes: routesIn(source),
    caseRoutes: caseRoutesIn(source),
    loc: linesOfCode(source),
    exports: exportsIn(source),
    specifiers: specifiersIn(source),
    constants: constantsIn(source),
    bootstrapped: bootstrappedIn(source),
    endpoints: endpointsIn(source),
    outbound: outboundIn(source, ownerFinder(source, foundBy)),
  };
}
