import { readFileSync } from 'node:fs';

const ENV_LINE = /^\s*(?:export\s+)?([A-Za-z_]\w*)\s*=\s*(.*?)\s*$/;
const QUOTED = /^(['"]).*\1$/;
const TRAILING_COMMENT = /\s+#.*$/;

/** `NAME=value` lines, as a `.env` file holds them; none when there is no file. */
export function envFile(file: string): Record<string, string> {
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return {};
  }
  const values: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = ENV_LINE.exec(line);
    if (!match) continue;
    const [, name, value] = match;
    values[name] = QUOTED.test(value) ? value.slice(1, -1) : value.replace(TRAILING_COMMENT, '');
  }
  return values;
}
