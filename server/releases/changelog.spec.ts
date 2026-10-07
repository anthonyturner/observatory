import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { changelogSections, versionKey } from './changelog.ts';

const CHANGELOG = `# Changelog

All notable changes.

## [Unreleased]

### Added

- Releases screen ([#484](https://github.com/me/app/pull/484)).

## [1.1.0] - 2026-03-01

### Fixed

- Export opens in Excel.

## v1.0.0 (2026-01-01)

- First release.

## [1.0.0] - an older duplicate

- Ignored.

[unreleased]: https://github.com/me/app/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/me/app/compare/v1.0.0...v1.1.0
`;

describe('versionKey', () => {
  it('reads a tag, a title and a heading the same way', () => {
    assert.equal(versionKey('v1.4.0'), '1.4.0');
    assert.equal(versionKey(' 1.4.0 '), '1.4.0');
    assert.equal(versionKey('Unreleased'), 'unreleased');
    assert.equal(versionKey('vNext'), 'vnext');
  });
});

describe('changelogSections', () => {
  const sections = changelogSections(CHANGELOG);

  it('keys each section by its version, with the markdown under its heading', () => {
    assert.deepEqual([...sections.keys()], ['unreleased', '1.1.0', '1.0.0']);
    assert.equal(
      sections.get('unreleased'),
      '### Added\n\n- Releases screen ([#484](https://github.com/me/app/pull/484)).',
    );
    assert.equal(sections.get('1.1.0'), '### Fixed\n\n- Export opens in Excel.');
  });

  it('keeps the first of a version listed twice, and drops the link definitions', () => {
    assert.equal(sections.get('1.0.0'), '- First release.');
  });

  it('finds nothing in a file without sections', () => {
    assert.equal(changelogSections('# Changelog\n\nNothing yet.').size, 0);
    assert.equal(changelogSections('').size, 0);
  });
});
