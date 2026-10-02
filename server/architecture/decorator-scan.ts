import ts from 'typescript';
import { ANGULAR_DECORATORS, type AngularDecorator } from './scanned-source.ts';

/** An Angular decorator on a class, and the options object passed to it, if any. */
export interface Decoration {
  readonly decorator: AngularDecorator;
  readonly options: ts.ObjectLiteralExpression | null;
}

export function decorationOf(node: ts.ClassDeclaration): Decoration | null {
  for (const { expression } of ts.getDecorators(node) ?? []) {
    if (!ts.isCallExpression(expression)) continue;
    const called = expression.expression.getText();
    const decorator = ANGULAR_DECORATORS.find((name) => name === called);
    if (!decorator) continue;
    const [options] = expression.arguments;
    return {
      decorator,
      options: options && ts.isObjectLiteralExpression(options) ? options : null,
    };
  }
  return null;
}

/** The value given to `key` in an object literal; null when it is absent. */
export function optionOf(
  options: ts.ObjectLiteralExpression | null,
  key: string,
): ts.Expression | null {
  for (const property of options?.properties ?? []) {
    if (ts.isPropertyAssignment(property) && property.name.getText() === key) {
      return property.initializer;
    }
  }
  return null;
}

/** The string given to `key`, such as `providedIn` or `selector`; null when it is not a plain string. */
export function textOption(options: ts.ObjectLiteralExpression | null, key: string): string | null {
  const value = optionOf(options, key);
  return value && ts.isStringLiteralLike(value) ? value.text : null;
}

/** The names listed plainly in an array literal, such as a component's `imports`. */
export function namesIn(list: ts.Expression | null): string[] {
  if (!list || !ts.isArrayLiteralExpression(list)) return [];
  return list.elements.flatMap((element) => (ts.isIdentifier(element) ? [element.text] : []));
}
