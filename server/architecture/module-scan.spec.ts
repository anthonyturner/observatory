import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { scanSource } from './source-scan.ts';

const scan = (text: string) => scanSource('a.ts', text);

describe('module facts', () => {
  it('lists what a file exports by name', () => {
    assert.deepEqual(
      scan(`
        export class A {}
        export function b() {}
        export const c = 1, d = 2;
        export interface E {}
        export type F = string;
        const g = 1;
        export { g, g as h };
        export default class {}
        export * from './other';
      `).exports,
      ['A', 'b', 'c', 'd', 'E', 'F', 'g', 'h', 'default'],
    );
  });

  it('lists every module imported, re-exported or loaded, once', () => {
    assert.deepEqual(
      scan(`
        import { a } from './a';
        import type { B } from '@angular/core';
        export * from './c';
        export { d } from './d';
        const lazy = () => import('./e');
        import { a2 } from './a';
      `).specifiers,
      ['./a', '@angular/core', './c', './d', './e'],
    );
  });

  it('keeps top-level constants that are text, or may be', () => {
    assert.deepEqual(
      scan(`
        export const BASE = 'https://api.example.com';
        const URL = \`\${BASE}/v1\`;
        const ALIAS = BASE;
        const NUMBER = 3;
        let changing = 'x';
      `).constants,
      [
        { name: 'BASE', parts: ['https://api.example.com'] },
        { name: 'URL', parts: ['', { name: 'BASE' }, '/v1'] },
        { name: 'ALIAS', parts: [{ name: 'BASE' }] },
      ],
    );
  });

  it('finds what the app is bootstrapped with', () => {
    assert.deepEqual(
      scan(`bootstrapApplication(App, appConfig).catch(console.error);`).bootstrapped,
      ['App', 'appConfig'],
    );
  });
});
