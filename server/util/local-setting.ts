import { join } from 'node:path';
import { OBSERVATORY_DIR } from '../store/file-store.ts';
import { envFile } from './env-file.ts';

export type Environment = Readonly<Record<string, string | undefined>>;

/** Kept outside the checkout, so no commit can carry a key written there. */
export const LOCAL_ENV_FILE = join(OBSERVATORY_DIR, '.env');

/** Setting `name` on this machine: the environment first, then the file; null for none. */
export function localSetting(
  name: string,
  env: Environment = process.env,
  file = LOCAL_ENV_FILE,
): string | null {
  return env[name] || envFile(file)[name] || null;
}
