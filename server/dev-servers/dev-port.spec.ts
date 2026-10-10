import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { describe, it } from 'node:test';
import { freeLoopbackPort, portFlagFor, withPort } from './dev-port.ts';

const FLAG = ' -- --port {port}';

const listenOn = (port: number): Promise<() => Promise<void>> =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () =>
      resolve(() => new Promise((done) => server.close(() => done()))),
    );
  });

describe('freeLoopbackPort', () => {
  it('picks a port that is free now, and a different one while the first is taken', async () => {
    const first = await freeLoopbackPort();
    const release = await listenOn(first);

    const second = await freeLoopbackPort();
    await release();

    assert.ok(first > 0);
    assert.notEqual(second, first);
    const releaseSecond = await listenOn(second);
    await releaseSecond();
  });
});

describe('portFlagFor', () => {
  it('asks each known dev CLI for the chosen port', () => {
    const scripts = [
      'ng serve',
      'ng serve --open',
      'ng serve my-app --configuration development',
      'vite',
      'vite --host',
      'vite dev',
      'vite serve --mode staging',
      'next dev',
      'next dev --turbopack',
      'astro dev',
      'nuxt dev',
      'nuxi dev',
      'webpack serve',
      'webpack-dev-server --mode development',
      'svelte-kit dev',
    ];

    for (const script of scripts) assert.equal(portFlagFor(script), FLAG, script);
  });

  it('leaves alone a script that is not a known dev CLI, or is a different command of one', () => {
    const scripts = [
      'node server.js',
      'concurrently "npm:api" "ng serve"',
      'ng build',
      'ng servers',
      'vite build',
      'vite preview',
      'next start',
      'cross-env NODE_ENV=development vite',
      '',
    ];

    for (const script of scripts) assert.equal(portFlagFor(script), '', script);
  });

  it('leaves alone a script that already names its own port', () => {
    assert.equal(portFlagFor('ng serve --port 4300'), '');
    assert.equal(portFlagFor('vite --host --port=5000'), '');
  });

  it('leaves alone a script that chains commands, where the flag would land on the last one', () => {
    const scripts = ['vite && node api.js', 'ng serve; echo done', 'ng serve | cat', 'ng serve &'];

    for (const script of scripts) assert.equal(portFlagFor(script), '', script);
  });

  it('reads past leading space', () => {
    assert.equal(portFlagFor('  ng serve'), FLAG);
  });
});

describe('withPort', () => {
  it('puts the port wherever the placeholder stands, as often as it stands', () => {
    assert.equal(
      withPort('make serve PORT={port} URL=:{port}', 4300),
      'make serve PORT=4300 URL=:4300',
    );
  });

  it('leaves a command without the placeholder as it is', () => {
    assert.equal(withPort('npm run dev', 4300), 'npm run dev');
  });
});
