import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type ReadJson, fileRunCommands } from './run-command.ts';

const OVERRIDES = 'run.json';
const FOLDER = 'E:/repos/app';

/** Files by path; a path not listed is missing. */
function filesOf(files: Record<string, unknown>): ReadJson {
  return (file) => files[file.replaceAll('\\', '/')];
}

const commandFor = (files: Record<string, unknown>, repo = 'me/app') =>
  fileRunCommands(OVERRIDES, filesOf(files)).commandFor(repo, FOLDER);

describe('fileRunCommands', () => {
  it('runs the dev script', () => {
    const files = {
      [`${FOLDER}/package.json`]: { scripts: { dev: 'node dev.js', start: 'node .' } },
    };

    assert.deepEqual(commandFor(files), { command: 'npm run dev', url: null });
  });

  it('asks a known dev CLI for the port Observatory chooses, through npm', () => {
    const dev = { [`${FOLDER}/package.json`]: { scripts: { dev: 'vite --host' } } };
    const start = { [`${FOLDER}/package.json`]: { scripts: { start: 'ng serve' } } };

    assert.deepEqual(commandFor(dev), { command: 'npm run dev -- --port {port}', url: null });
    assert.deepEqual(commandFor(start), { command: 'npm start -- --port {port}', url: null });
  });

  it('runs the start script when there is no dev script', () => {
    const files = { [`${FOLDER}/package.json`]: { scripts: { start: 'node .', build: 'tsc' } } };

    assert.deepEqual(commandFor(files), { command: 'npm start', url: null });
  });

  it('has nothing to run without either script, or without a package.json', () => {
    assert.equal(commandFor({ [`${FOLDER}/package.json`]: { scripts: { build: 'tsc' } } }), null);
    assert.equal(commandFor({ [`${FOLDER}/package.json`]: { scripts: { dev: 4 } } }), null);
    assert.equal(commandFor({ [`${FOLDER}/package.json`]: 'not an object' }), null);
    assert.equal(commandFor({}), null);
  });

  it('prefers the owner’s command and address, found whatever the repository’s case', () => {
    const files = {
      [OVERRIDES]: { 'Me/App': { command: ' pnpm dev --host ', url: 'https://app.test:8443/' } },
      [`${FOLDER}/package.json`]: { scripts: { dev: 'vite' } },
    };

    assert.deepEqual(commandFor(files), {
      command: 'pnpm dev --host',
      url: 'https://app.test:8443/',
    });
  });

  it('keeps the {port} placeholder of the owner’s command for Observatory to fill', () => {
    const files = { [OVERRIDES]: { 'me/app': { command: 'make serve PORT={port}' } } };

    assert.deepEqual(commandFor(files), { command: 'make serve PORT={port}', url: null });
  });

  it('lets an override with only a command leave the address to the server', () => {
    const files = { [OVERRIDES]: { 'me/app': { command: 'make serve' } } };

    assert.deepEqual(commandFor(files), { command: 'make serve', url: null });
  });

  it('drops an address that is not a web address, and an entry with no command', () => {
    const files = {
      [OVERRIDES]: {
        'me/app': { command: 'make serve', url: 'file:///etc/passwd' },
        'me/other': {},
      },
      [`${FOLDER}/package.json`]: { scripts: { dev: 'vite' } },
    };

    assert.deepEqual(commandFor(files), { command: 'make serve', url: null });
    assert.deepEqual(commandFor(files, 'me/other'), {
      command: 'npm run dev -- --port {port}',
      url: null,
    });
  });

  it('ignores a run.json that is not an object of projects', () => {
    const files = {
      [OVERRIDES]: ['me/app'],
      [`${FOLDER}/package.json`]: { scripts: { dev: 'x' } },
    };

    assert.deepEqual(commandFor(files), { command: 'npm run dev', url: null });
  });
});
