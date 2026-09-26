import { type Environment, LOCAL_ENV_FILE, localSetting } from '../util/local-setting.ts';

const KEY_NAME = 'OPENROUTER_API_KEY';

/** The OpenRouter key on this machine: the environment first, then the file; null for none. */
export const localKey = (env: Environment = process.env, file = LOCAL_ENV_FILE): string | null =>
  localSetting(KEY_NAME, env, file);
