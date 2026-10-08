import ts from 'typescript';

const isDocumentation = ({ kind }: ts.Node): boolean =>
  kind >= ts.SyntaxKind.FirstJSDocNode && kind <= ts.SyntaxKind.LastJSDocNode;

/**
 * The lines of a source file that hold code: those a token starts or runs across.
 * A blank line and a line of only comment hold none, and a string or template
 * that spans lines counts every line of it.
 */
export function linesOfCode(source: ts.SourceFile): number {
  const lines = new Set<number>();
  const lineOf = (position: number): number => source.getLineAndCharacterOfPosition(position).line;
  const visit = (node: ts.Node): void => {
    if (isDocumentation(node)) return;
    const children = node.getChildren(source);
    if (children.length > 0) {
      children.forEach(visit);
      return;
    }
    const start = node.getStart(source);
    if (node.end === start) return;
    for (let line = lineOf(start); line <= lineOf(node.end); line += 1) lines.add(line);
  };
  visit(source);
  return lines.size;
}
