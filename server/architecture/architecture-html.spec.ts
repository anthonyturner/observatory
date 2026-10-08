import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { MAP_ELEMENT_ID } from '../../viewer/architecture-map/map-source.ts';
import type { ArchitectureMap } from './architecture-types.ts';
import { architectureHtml } from './architecture-html.ts';
import { SAMPLE_MAP } from './sample-map.ts';

const SCRIPT_CLOSE = '</script';
const LINE_SEPARATOR = String.fromCharCode(0x2028);

/** A map whose names try to break out of the page: they close the script, open a comment, split a line. */
const hostile: ArchitectureMap = {
  ...SAMPLE_MAP,
  project: `<b>x</b></script><!-- ${LINE_SEPARATOR}`,
  nodes: SAMPLE_MAP.nodes.map((node, at) =>
    at === 0 ? { ...node, name: `Evil</script><script>alert(1)</script>${LINE_SEPARATOR}` } : node,
  ),
};

const occurrences = (text: string, part: string): number => text.split(part).length - 1;

describe('architectureHtml', () => {
  let html = '';
  before(async () => {
    html = await architectureHtml(hostile);
  });

  it('writes the whole map into the page as JSON that reads back the same', () => {
    const open = `<script type="application/json" id="${MAP_ELEMENT_ID}">`;
    const start = html.indexOf(open) + open.length;
    const json = html.slice(start, html.indexOf(SCRIPT_CLOSE, start));
    assert.deepEqual(JSON.parse(json), hostile);
    assert.equal(json.includes(LINE_SEPARATOR), false);
  });

  it('cannot be broken out of by what the map says: only its own two scripts close', () => {
    assert.equal(occurrences(html, SCRIPT_CLOSE), 2);
    assert.equal(html.includes('<title>Architecture map: &#60;b&#62;x'), true);
  });

  it('holds the viewer and its styles, and reaches for nothing on the network', () => {
    assert.ok(html.includes('board__world'), 'the Circuit view is in the page');
    assert.ok(html.includes('<style>'));
    assert.equal(/<link\b/.test(html), false);
    assert.equal(/\b(?:src|href)\s*=\s*["']?(?:https?:)?\/\//.test(html), false);
  });

  it('refuses a map of another schema, and a map that breaks its own rules', async () => {
    await assert.rejects(
      architectureHtml({ ...SAMPLE_MAP, schema: 2 }),
      /schema 2.*reads schema 3/,
    );
    const broken: ArchitectureMap = {
      ...SAMPLE_MAP,
      edges: [
        ...SAMPLE_MAP.edges,
        { ...(SAMPLE_MAP.edges[0] as ArchitectureMap['edges'][number]), to: 'nowhere#Ghost' },
      ],
    };
    await assert.rejects(architectureHtml(broken), /breaks its own rules: .*nowhere#Ghost/);
  });
});
