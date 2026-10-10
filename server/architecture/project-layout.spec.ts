import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fixtureProject } from './fixture-project.testing.ts';
import { detectLayout } from './project-layout.ts';

const angularJson = (extra: object = {}) =>
  JSON.stringify({
    projects: {
      web: {
        projectType: 'application',
        sourceRoot: 'src',
        architect: { build: { options: { browser: 'src/main.ts' } } },
        ...extra,
      },
    },
  });

const rootsOf = async (root: string, options = {}) =>
  (await detectLayout(root, options)).runtimes.map(({ id, root: folder }) => [id, folder]);

describe('detectLayout: runtimes', () => {
  it('finds the Angular app in its whole source root and the API in server/', async () => {
    const root = fixtureProject({
      'angular.json': angularJson(),
      'src/app/app.ts': '',
      'server/main.ts': '',
    });
    assert.deepEqual(await rootsOf(root), [
      ['browser', 'src'],
      ['server', 'server'],
    ]);
  });

  it('reads a source root other than src, with comments in the config', async () => {
    const root = fixtureProject({
      'angular.json': `{ // a comment
        "projects": { "web": { "projectType": "application", "sourceRoot": "projects/web/src" } } }`,
      'projects/web/src/app/app.ts': '',
    });
    assert.deepEqual(await rootsOf(root), [['browser', 'projects/web/src']]);
  });

  it('takes src when the application names no source root, and nothing when the folder is missing', async () => {
    const named = (extra: object) =>
      JSON.stringify({ projects: { web: { projectType: 'application', ...extra } } });
    const root = fixtureProject({ 'angular.json': named({}), 'src/ui/panel.ts': '' });
    assert.deepEqual(await rootsOf(root), [['browser', 'src']]);
    const missing = fixtureProject({ 'angular.json': named({ sourceRoot: 'lib' }) });
    assert.deepEqual(await rootsOf(missing), []);
  });

  it('falls back to src/app without an angular.json, and finds nothing in a plain src', async () => {
    assert.deepEqual(await rootsOf(fixtureProject({ 'src/app/app.ts': '' })), [
      ['browser', 'src/app'],
    ]);
    assert.deepEqual(await rootsOf(fixtureProject({ 'src/index.ts': '' })), []);
  });

  it('takes the first of server, backend and api that holds TypeScript', async () => {
    const root = fixtureProject({
      'server/readme.md': '',
      'backend/main.ts': '',
      'api/index.ts': '',
    });
    assert.deepEqual(await rootsOf(root), [['server', 'backend']]);
  });

  it('lets an option name the folder, and refuses one with no TypeScript', async () => {
    const root = fixtureProject({ 'services/api/main.ts': '', 'server/main.ts': '' });
    assert.deepEqual(await rootsOf(root, { serverRoot: 'services/api' }), [
      ['server', 'services/api'],
    ]);
    await assert.rejects(detectLayout(root, { serverRoot: 'nowhere' }), /No TypeScript files/);
  });
});

describe('detectLayout: entry files', () => {
  it('lists the app’s entry and the files package scripts run, leaving globs out', async () => {
    const root = fixtureProject({
      'angular.json': angularJson(),
      'package.json': JSON.stringify({
        scripts: {
          api: 'node --watch server/main.ts',
          test: 'node --test "server/**/*.spec.ts"',
          tool: 'node ./tools/build.mjs --fast',
          lint: 'eslint .',
        },
      }),
    });
    assert.deepEqual((await detectLayout(root)).entryFiles, [
      'server/main.ts',
      'src/main.ts',
      'tools/build.mjs',
    ]);
  });
});
