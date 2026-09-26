/** "1 issue", "3 issues": a count with its noun in the right number. */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
