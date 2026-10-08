import ts from 'typescript';

const isFunctionValue = (node: ts.Node | undefined): boolean =>
  node !== undefined && (ts.isArrowFunction(node) || ts.isFunctionExpression(node));

const isShapeOnly = (node: ts.Node): boolean =>
  ts.isInterfaceDeclaration(node) ||
  ts.isTypeAliasDeclaration(node) ||
  ts.isImportDeclaration(node) ||
  ts.isImportEqualsDeclaration(node) ||
  ts.isExportDeclaration(node) ||
  ts.isExportAssignment(node);

/** A statement that only names or holds work: what is inside it is counted there. */
const isContainer = (node: ts.Node): boolean =>
  ts.isBlock(node) ||
  ts.isEmptyStatement(node) ||
  ts.isFunctionDeclaration(node) ||
  ts.isClassDeclaration(node) ||
  ts.isModuleDeclaration(node) ||
  (ts.isVariableStatement(node) &&
    node.declarationList.declarations.every(({ initializer }) => isFunctionValue(initializer)));

/** Whether `node` is one unit of the work a module hides. */
function isWork(node: ts.Node): boolean {
  if (ts.isStatement(node)) return !isContainer(node) && !isShapeOnly(node);
  if (ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node) || ts.isAccessor(node)) {
    return node.body !== undefined;
  }
  if (ts.isPropertyDeclaration(node)) {
    return node.initializer !== undefined && !isFunctionValue(node.initializer);
  }
  return ts.isArrowFunction(node) && !ts.isBlock(node.body);
}

/**
 * How much a source file does: its statements, its methods and initialised
 * fields, and its expression-bodied arrows. A function or class only holds the
 * work inside it. Imports, re-exports and type declarations run nothing, and
 * comments and layout are not syntax, so none of them can move the count.
 */
export function implementationSize(source: ts.SourceFile): number {
  let size = 0;
  const visit = (node: ts.Node): void => {
    if (isWork(node)) size++;
    ts.forEachChild(node, visit);
  };
  visit(source);
  return size;
}
