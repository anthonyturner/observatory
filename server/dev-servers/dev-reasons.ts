export const NO_CHECKOUT =
  'There is no local checkout of this project on this machine. Add one to ~/.claude/observatory/clones.json.';
export const NO_COMMAND =
  'This project has no "dev" or "start" script. Add a command for it to ~/.claude/observatory/run.json.';
export const NO_SITE =
  'The server printed nothing and nothing answered at an address we could find, so it was stopped. Add a "url" for it to ~/.claude/observatory/run.json.';
export const NO_PORT = 'No free port could be found to run the server on.';

const quoted = (line: string): string => `"${line}"`;

/** How a dev server ended on its own, with the last thing it said. */
export function exitReason(code: number | null, lastLine: string): string {
  const how = code === null ? 'was ended' : `exited with code ${code}`;
  return `The dev server ${how}.${lastLine ? ` Its last output: ${quoted(lastLine)}` : ''}`;
}

/** Why a server whose site never answered was stopped. */
export function timeoutReason(address: string | null, lastLine: string): string {
  if (!lastLine) return NO_SITE;
  const where = address ? ` at ${address}` : '';
  return `Nothing answered${where} within two minutes, so the server was stopped. Its last output: ${quoted(lastLine)}. If the site is elsewhere, add a "url" for it to ~/.claude/observatory/run.json.`;
}
