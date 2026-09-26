import { type Environment, LOCAL_ENV_FILE, localSetting } from '../util/local-setting.ts';

/** What turns the ElevenLabs voice on, and which voice it starts in. */
export interface ElevenLabsSettings {
  /** Null for none: the voice is then off, and the page speaks with its own. */
  readonly key: string | null;
  /** `ELEVENLABS_VOICE_ID`: the default voice when the account has it. */
  readonly preferredVoice: string | null;
}

export const ELEVENLABS_ENV = {
  key: 'ELEVENLABS_API_KEY',
  voice: 'ELEVENLABS_VOICE_ID',
} as const;

/** The settings on this machine: each from the environment first, then the file. */
export const localElevenLabs = (
  env: Environment = process.env,
  file = LOCAL_ENV_FILE,
): ElevenLabsSettings => ({
  key: localSetting(ELEVENLABS_ENV.key, env, file),
  preferredVoice: localSetting(ELEVENLABS_ENV.voice, env, file),
});
