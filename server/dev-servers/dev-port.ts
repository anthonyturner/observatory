import { createServer } from 'node:net';

/** Where in a command line the port goes. */
export const PORT_PLACEHOLDER = '{port}';

/** Picks a port nothing on this machine is listening on. */
export type FreePort = () => Promise<number>;

/** Asks the system for an unused loopback port by listening on port 0, then letting go of it. */
export const freeLoopbackPort: FreePort = () =>
  new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });

/** Dev CLIs known to take `--port`, matched at the start of a package script. A bare `vite`
 *  counts only when no other subcommand follows, so `vite build` is left alone. */
const PORT_FLAG_CLIS: readonly RegExp[] = [
  /^ng serve(?=\s|$)/,
  /^vite(\s+(dev|serve))?(?=\s+-|\s*$)/,
  /^next dev(?=\s|$)/,
  /^astro dev(?=\s|$)/,
  /^(nuxt|nuxi) dev(?=\s|$)/,
  /^webpack serve(?=\s|$)/,
  /^webpack-dev-server(?=\s|$)/,
  /^svelte-kit dev(?=\s|$)/,
];
const PORT_ALREADY_SET = /(^|\s)--port\b/;

/**
 * What to append to `npm run <script>` so the server takes the port Observatory
 * chose: the `--port` flag as a placeholder, or nothing when the script is not a
 * known dev CLI or already names its own port. The environment's `PORT` reaches
 * servers that read it; the known CLIs only take the flag.
 */
export function portFlagFor(scriptBody: string): string {
  const body = scriptBody.trim();
  const takesFlag = PORT_FLAG_CLIS.some((cli) => cli.test(body)) && !PORT_ALREADY_SET.test(body);
  return takesFlag ? ` -- --port ${PORT_PLACEHOLDER}` : '';
}

/** `command` with `port` where its placeholder stands. */
export const withPort = (command: string, port: number): string =>
  command.replaceAll(PORT_PLACEHOLDER, String(port));
