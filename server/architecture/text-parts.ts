import ts from 'typescript';

/**
 * One piece of a string an expression builds: literal text, or a name the
 * project looks up later. A null name stands for a value only a run could tell.
 */
export type TextPart = string | { readonly name: string | null };

/** What a value nothing could look up reads as once the parts are joined; no URL, path or program contains it. */
export const UNKNOWN_TEXT = '\u0000';

const isWrapper = (
  node: ts.Expression,
): node is
  ts.ParenthesizedExpression | ts.AsExpression | ts.NonNullExpression | ts.SatisfiesExpression =>
  ts.isParenthesizedExpression(node) ||
  ts.isAsExpression(node) ||
  ts.isNonNullExpression(node) ||
  ts.isSatisfiesExpression(node);

/** The text an expression builds from literals, templates, `+` and bare names; anything else is an unknown part. */
export function textPartsOf(node: ts.Expression): TextPart[] {
  if (ts.isStringLiteralLike(node)) return [node.text];
  if (isWrapper(node)) return textPartsOf(node.expression);
  if (ts.isIdentifier(node)) return [{ name: node.text }];
  if (ts.isTemplateExpression(node)) {
    return [
      node.head.text,
      ...node.templateSpans.flatMap(({ expression, literal }) => [
        ...textPartsOf(expression),
        literal.text,
      ]),
    ];
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return [...textPartsOf(node.left), ...textPartsOf(node.right)];
  }
  return [{ name: null }];
}
