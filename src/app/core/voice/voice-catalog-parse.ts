import { CatalogState, CatalogVoice } from './voice-catalog.types';

type Json = Readonly<Record<string, unknown>>;

export const UNAVAILABLE: CatalogState = { status: 'unavailable' };
const OFF: CatalogState = { status: 'off' };

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string' && value !== '';
const textOrNull = (value: unknown): string | null => (isText(value) ? value : null);

function parseVoice(value: unknown): CatalogVoice | null {
  if (!isObject(value) || !isText(value['id']) || !isText(value['name'])) return null;
  return { id: value['id'], name: value['name'] };
}

function voicesOf(value: unknown): readonly CatalogVoice[] {
  const listed = Array.isArray(value) ? value : [];
  return listed.map(parseVoice).filter((voice) => voice !== null);
}

/** `GET /api/voice`'s answer, or `unavailable` when it is not one. An odd
 *  voice is dropped rather than trusted. */
export function parseCatalog(body: unknown): CatalogState {
  if (!isObject(body)) return UNAVAILABLE;
  if (body['elevenlabs'] === 'off') return OFF;
  if (body['elevenlabs'] !== 'on') return UNAVAILABLE;
  return {
    status: 'on',
    voices: voicesOf(body['voices']),
    defaultVoice: textOrNull(body['defaultVoice']),
    failed: textOrNull(body['failed']),
  };
}
