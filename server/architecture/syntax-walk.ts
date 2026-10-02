import ts from 'typescript';

/** What `pick` finds first in `node` or anything inside it, depth first; undefined for nothing. */
export function firstIn<T>(node: ts.Node, pick: (child: ts.Node) => T | undefined): T | undefined {
  const visit = (child: ts.Node): T | undefined => pick(child) ?? ts.forEachChild(child, visit);
  return visit(node);
}

/** Everything `pick` finds in `node` and anything inside it, depth first. */
export function allIn<T>(node: ts.Node, pick: (child: ts.Node) => T | undefined): T[] {
  const found: T[] = [];
  const visit = (child: ts.Node): void => {
    const value = pick(child);
    if (value !== undefined) found.push(value);
    ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
}
