import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { rewriteLinks, type LinkContext } from './wiki-links.ts';

const REPO = 'https://github.com/me/app';
const WIKI = `${REPO}/wiki`;

const context = (source: string): LinkContext => ({
  source,
  repoUrl: REPO,
  branch: 'main',
  pageBySource: new Map([
    ['README.md', 'Home'],
    ['docs/tech-stack.md', 'Tech-stack'],
    ['docs/decisions/README.md', 'Decisions'],
    ['docs/decisions/0007-squash.md', 'ADR-0007-squash'],
  ]),
});

describe('rewriteLinks', () => {
  it('points a link to a published file at its wiki page, keeping the anchor', () => {
    const fromReadme = rewriteLinks(
      'See [the stack](docs/tech-stack.md#build).',
      context('README.md'),
    );
    const fromDecision = rewriteLinks(
      '[ADR](0007-squash.md), [index](./README.md)',
      context('docs/decisions/0001-a.md'),
    );

    assert.equal(fromReadme, `See [the stack](${WIKI}/Tech-stack#build).`);
    assert.equal(fromDecision, `[ADR](${WIKI}/ADR-0007-squash), [index](${WIKI}/Decisions)`);
  });

  it('points a link to an unpublished file at GitHub, resolved from the page’s folder', () => {
    const markdown = '[rules](../rules.md) and [server](../../server/) and [root](/AGENTS.md)';

    assert.equal(
      rewriteLinks(markdown, context('docs/decisions/0001-a.md')),
      `[rules](${REPO}/blob/main/docs/rules.md) and [server](${REPO}/tree/main/server)` +
        ` and [root](${REPO}/blob/main/AGENTS.md)`,
    );
  });

  it('serves images raw, in markdown and in HTML alike', () => {
    const markdown = '![worlds](images/worlds.png)\n<td><img src="docs/images/o.jpg" alt="o"></td>';

    assert.equal(
      rewriteLinks(markdown, context('docs/sky.md')).split('\n')[0],
      `![worlds](${REPO}/raw/main/docs/images/worlds.png)`,
    );
    assert.equal(
      rewriteLinks(markdown, context('README.md')).split('\n')[1],
      `<td><img src="${REPO}/raw/main/docs/images/o.jpg" alt="o"></td>`,
    );
  });

  it('rewrites a reference-style link definition', () => {
    assert.equal(
      rewriteLinks('[stack]: docs/tech-stack.md', context('README.md')),
      `[stack]: ${WIKI}/Tech-stack`,
    );
  });

  it('leaves absolute URLs, mail links and same-page anchors as written', () => {
    const markdown =
      '[a](https://x.dev/a.md) [b](mailto:me@x.dev) [c](#heading) <a href="//cdn.x/y">';

    assert.equal(rewriteLinks(markdown, context('README.md')), markdown);
  });

  it('leaves code blocks and code spans as written', () => {
    const markdown = [
      'Write `[x](docs/tech-stack.md)` like this:',
      '```markdown',
      '[stack](docs/tech-stack.md)',
      '```',
      '[stack](docs/tech-stack.md)',
    ].join('\n');

    assert.deepEqual(rewriteLinks(markdown, context('README.md')).split('\n'), [
      'Write `[x](docs/tech-stack.md)` like this:',
      '```markdown',
      '[stack](docs/tech-stack.md)',
      '```',
      `[stack](${WIKI}/Tech-stack)`,
    ]);
  });

  it('leaves a link that climbs out of the repository as written', () => {
    assert.equal(rewriteLinks('[up](../../x.md)', context('docs/a.md')), '[up](../../x.md)');
  });
});
