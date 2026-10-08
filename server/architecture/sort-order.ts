/** Orders text by code unit, the same on every machine; `localeCompare` follows the machine's locale. */
export const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
