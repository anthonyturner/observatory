import ts from 'typescript';
import { optionOf, textOption } from './decorator-scan.ts';
import type { ScannedOutbound } from './scanned-source.ts';
import { allIn } from './syntax-walk.ts';
import { type TextPart, textPartsOf } from './text-parts.ts';

const HTTP_CLIENT = 'HttpClient';
const HTTP_VERBS: readonly string[] = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
const HTTP_MODULES: readonly string[] = ['http', 'https', 'node:http', 'node:https'];
const PROCESS_MODULES: readonly string[] = ['child_process', 'node:child_process'];
const PROCESS_FUNCTIONS: readonly string[] = [
  'spawn',
  'spawnSync',
  'exec',
  'execSync',
  'execFile',
  'execFileSync',
  'fork',
];
/** The functions whose first argument is a whole command line rather than a program. */
const COMMAND_LINE_FUNCTIONS: readonly string[] = ['exec', 'execSync'];
/** The constructors that open a connection to the address they are given. */
const CONNECTIONS: readonly string[] = ['EventSource', 'WebSocket'];
const DEFAULT_METHOD = 'GET';
const WHITESPACE = /\s+/;

/** What a file calls things by: the local names for HttpClient instances and for the modules it imports. */
interface Bindings {
  /** Names of HttpClient instances: fields, parameters and variables. */
  readonly clients: ReadonlySet<string>;
  /** Names that hold `fetch`, such as `send` in `const send = config.fetch ?? fetch`. */
  readonly fetchers: ReadonlySet<string>;
  /** A local function that starts a process, by the child_process function it is. */
  readonly spawners: ReadonlyMap<string, string>;
  /** Local names for the whole child_process module. */
  readonly processModules: ReadonlySet<string>;
  /** Local names for the whole http or https module. */
  readonly httpModules: ReadonlySet<string>;
}

type OwnerOf = (node: ts.Node) => string | null;

const isClientType = (type: ts.TypeNode | undefined): boolean =>
  type !== undefined &&
  ts.isTypeReferenceNode(type) &&
  ts.isIdentifier(type.typeName) &&
  type.typeName.text === HTTP_CLIENT;

const injectsClient = (initializer: ts.Expression | undefined): boolean =>
  initializer !== undefined &&
  ts.isCallExpression(initializer) &&
  initializer.expression.getText() === 'inject' &&
  initializer.arguments[0]?.getText() === HTTP_CLIENT;

function clientName(node: ts.Node): string | undefined {
  if (!ts.isParameter(node) && !ts.isPropertyDeclaration(node) && !ts.isVariableDeclaration(node)) {
    return undefined;
  }
  const holdsClient = isClientType(node.type) || injectsClient(node.initializer);
  return holdsClient && ts.isIdentifier(node.name) ? node.name.text : undefined;
}

const FETCH = 'fetch';

/** Whether an expression is `fetch`, `x.fetch`, or a choice between such values. */
function holdsFetch(node: ts.Expression): boolean {
  if (ts.isIdentifier(node)) return node.text === FETCH;
  if (ts.isPropertyAccessExpression(node)) return node.name.text === FETCH;
  if (ts.isParenthesizedExpression(node)) return holdsFetch(node.expression);
  const isChoice =
    ts.isBinaryExpression(node) &&
    (node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
      node.operatorToken.kind === ts.SyntaxKind.BarBarToken);
  return isChoice && (holdsFetch(node.left) || holdsFetch(node.right));
}

const isFetchType = (type: ts.TypeNode | undefined): boolean =>
  type !== undefined && ts.isTypeQueryNode(type) && type.exprName.getText() === FETCH;

/** A variable, parameter or destructured name that is given `fetch`, whatever it is called. */
function fetcherName(node: ts.Node): string | undefined {
  if (ts.isBindingElement(node) && ts.isIdentifier(node.name)) {
    const isFetchProperty = node.propertyName?.getText() === FETCH;
    return isFetchProperty || (node.initializer && holdsFetch(node.initializer))
      ? node.name.text
      : undefined;
  }
  if (!ts.isVariableDeclaration(node) && !ts.isParameter(node)) return undefined;
  const given = node.initializer !== undefined && holdsFetch(node.initializer);
  return ts.isIdentifier(node.name) && (given || isFetchType(node.type))
    ? node.name.text
    : undefined;
}

interface ModuleNames {
  readonly spawners: Map<string, string>;
  readonly processModules: Set<string>;
  readonly httpModules: Set<string>;
}

/** What the file's imports from child_process, http and https are called locally. */
function moduleNamesIn(source: ts.SourceFile): ModuleNames {
  const names: ModuleNames = {
    spawners: new Map(),
    processModules: new Set(),
    httpModules: new Set(),
  };
  for (const { moduleSpecifier, importClause } of source.statements.filter(
    ts.isImportDeclaration,
  )) {
    if (!ts.isStringLiteral(moduleSpecifier) || !importClause) continue;
    const bindings = importClause.namedBindings;
    const whole = [
      importClause.name,
      bindings && ts.isNamespaceImport(bindings) ? bindings.name : undefined,
    ];
    const wholeNames = whole.flatMap((name) => (name ? [name.text] : []));
    if (HTTP_MODULES.includes(moduleSpecifier.text)) {
      wholeNames.forEach((name) => names.httpModules.add(name));
    }
    if (!PROCESS_MODULES.includes(moduleSpecifier.text)) continue;
    wholeNames.forEach((name) => names.processModules.add(name));
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const { name, propertyName } of bindings.elements) {
      const imported = propertyName?.text ?? name.text;
      if (PROCESS_FUNCTIONS.includes(imported)) names.spawners.set(name.text, imported);
    }
  }
  return names;
}

/** `const run = promisify(execFile)` makes `run` another way to start the same kind of process. */
function promisedSpawners(
  source: ts.SourceFile,
  known: ReadonlyMap<string, string>,
): [string, string][] {
  return allIn(source, (node): [string, string] | undefined => {
    if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name)) return undefined;
    const call = node.initializer;
    if (!call || !ts.isCallExpression(call) || call.expression.getText() !== 'promisify') {
      return undefined;
    }
    const wrapped = call.arguments[0];
    const base = wrapped && ts.isIdentifier(wrapped) ? known.get(wrapped.text) : undefined;
    return base === undefined ? undefined : [node.name.text, base];
  });
}

function bindingsOf(source: ts.SourceFile): Bindings {
  const { spawners, processModules, httpModules } = moduleNamesIn(source);
  return {
    clients: new Set(allIn(source, clientName)),
    fetchers: new Set(allIn(source, fetcherName)),
    spawners: new Map([...spawners, ...promisedSpawners(source, spawners)]),
    processModules,
    httpModules,
  };
}

/** The verb an options object names as `method`, GET when it names none, null when it is not plain text. */
function methodOfOptions(options: ts.Expression | undefined): string | null {
  if (options === undefined) return DEFAULT_METHOD;
  if (!ts.isObjectLiteralExpression(options)) return null;
  if (optionOf(options, 'method') === null) return DEFAULT_METHOD;
  return textOption(options, 'method')?.toUpperCase() ?? null;
}

function request(
  method: string | null,
  url: ts.Expression | undefined,
  owner: string | null,
): ScannedOutbound[] {
  return url ? [{ via: 'http', method, target: textPartsOf(url), owner }] : [];
}

/** The field or variable a call is made on: `http` in `http.get()`, and `http` in `this.http.get()`. */
function receiverName(receiver: ts.Expression): string | null {
  if (ts.isIdentifier(receiver)) return receiver.text;
  const isThisField =
    ts.isPropertyAccessExpression(receiver) &&
    receiver.expression.kind === ts.SyntaxKind.ThisKeyword;
  return isThisField ? receiver.name.text : null;
}

/** `client.get(url)` and the other verbs, and `client.request(method, url)`. */
function clientCall(
  { expression, arguments: args }: ts.CallExpression,
  owner: string | null,
  clients: ReadonlySet<string>,
): ScannedOutbound[] {
  if (!ts.isPropertyAccessExpression(expression)) return [];
  const name = receiverName(expression.expression);
  if (name === null || !clients.has(name)) return [];
  const verb = expression.name.text;
  if (HTTP_VERBS.includes(verb)) return request(verb.toUpperCase(), args[0], owner);
  if (verb !== 'request') return [];
  const [method] = args;
  const named = method && ts.isStringLiteralLike(method) ? method.text.toUpperCase() : null;
  return request(named, args[1], owner);
}

/** `fetch(url)`, `window.fetch(url)`, `x.fetch(url)` for a fetch an object carries, or a name that holds fetch. */
const isFetch = (callee: ts.Expression, fetchers: ReadonlySet<string>): boolean =>
  (ts.isIdentifier(callee) && (callee.text === FETCH || fetchers.has(callee.text))) ||
  (ts.isPropertyAccessExpression(callee) && callee.name.text === FETCH);

/** `https.get(url)` and `https.request(url)` off a whole-module import. */
function httpModuleCall(
  { expression, arguments: args }: ts.CallExpression,
  owner: string | null,
  modules: ReadonlySet<string>,
): ScannedOutbound[] {
  if (!ts.isPropertyAccessExpression(expression) || !ts.isIdentifier(expression.expression)) {
    return [];
  }
  if (!modules.has(expression.expression.text)) return [];
  const verb = expression.name.text;
  if (verb !== 'get' && verb !== 'request') return [];
  return request(verb === 'get' ? DEFAULT_METHOD : null, args[0], owner);
}

/** The child_process function a call runs: bare, promisified under another name, or off the module. */
function processFunctionOf(callee: ts.Expression, bindings: Bindings): string | null {
  if (ts.isIdentifier(callee)) return bindings.spawners.get(callee.text) ?? null;
  if (!ts.isPropertyAccessExpression(callee) || !ts.isIdentifier(callee.expression)) return null;
  const isModule = bindings.processModules.has(callee.expression.text);
  return isModule && PROCESS_FUNCTIONS.includes(callee.name.text) ? callee.name.text : null;
}

/** A command line's first word is the program; the program of anything built at run time is unknown. */
function programOf(parts: readonly TextPart[], isCommandLine: boolean): TextPart[] {
  const [first] = parts;
  if (!isCommandLine || typeof first !== 'string') return [...parts];
  return [first.trim().split(WHITESPACE)[0] ?? ''];
}

function processCall(
  call: ts.CallExpression,
  owner: string | null,
  bindings: Bindings,
): ScannedOutbound[] {
  const fn = processFunctionOf(call.expression, bindings);
  const [program] = call.arguments;
  if (fn === null || !program) return [];
  const target = programOf(textPartsOf(program), COMMAND_LINE_FUNCTIONS.includes(fn));
  return [{ via: 'process', method: null, target, owner }];
}

function callsOut(
  node: ts.CallExpression | ts.NewExpression,
  bindings: Bindings,
  owner: string | null,
): ScannedOutbound[] {
  if (ts.isNewExpression(node)) {
    const isConnection =
      ts.isIdentifier(node.expression) && CONNECTIONS.includes(node.expression.text);
    return isConnection ? request(DEFAULT_METHOD, node.arguments?.[0], owner) : [];
  }
  if (isFetch(node.expression, bindings.fetchers)) {
    return request(methodOfOptions(node.arguments[1]), node.arguments[0], owner);
  }
  return [
    ...clientCall(node, owner, bindings.clients),
    ...httpModuleCall(node, owner, bindings.httpModules),
    ...processCall(node, owner, bindings),
  ];
}

/**
 * Every call in a file that leaves the process: a request over HTTP, made by an
 * HttpClient, `fetch`, an EventSource or the http module, and a child process
 * started through child_process. `ownerOf` names the declaration a node sits in.
 */
export function outboundIn(source: ts.SourceFile, ownerOf: OwnerOf): ScannedOutbound[] {
  const bindings = bindingsOf(source);
  return allIn(source, (node) => {
    if (!ts.isCallExpression(node) && !ts.isNewExpression(node)) return undefined;
    const found = callsOut(node, bindings, ownerOf(node));
    return found.length > 0 ? found : undefined;
  }).flat();
}
