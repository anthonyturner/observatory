import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { elementOf, tagsIn } from './template-tags.ts';

describe('tagsIn', () => {
  it('lists each custom element once, in lower case, and skips plain HTML', () => {
    const html = `<div><App-Dial></App-Dial><app-dial /><span>a-b</span><clock-hands-x></clock-hands-x></div>`;
    assert.deepEqual(tagsIn(html), ['app-dial', 'clock-hands-x']);
  });
});

describe('elementOf', () => {
  it('takes the element of the first alternative', () => {
    assert.equal(elementOf('app-dial'), 'app-dial');
    assert.equal(elementOf(' app-dial[big], app-face'), 'app-dial');
  });

  it('returns null for an attribute or class selector', () => {
    assert.equal(elementOf('[appTick]'), null);
    assert.equal(elementOf('.face'), null);
    assert.equal(elementOf('div'), null);
  });
});
