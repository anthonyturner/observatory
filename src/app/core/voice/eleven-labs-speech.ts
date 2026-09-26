import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface SpeechRequest {
  readonly text: string;
  readonly voice: string;
}

/** One sentence spoken by ElevenLabs, through the site, as encoded audio.
 *  Rejects with an ElevenLabsRefusal when the site says no. */
export interface ElevenLabsSpeech {
  speak(request: SpeechRequest): Promise<ArrayBuffer>;
}

/** Why the site did not speak, as a clause a reply can use as it is. */
export class ElevenLabsRefusal extends Error {
  constructor(words: string) {
    super(words);
    this.name = 'ElevenLabsRefusal';
  }
}

const SPEAK_URL = '/api/voice/speak';
/** The API accepts writes only with this header, which no other site can add. */
const WRITE_HEADERS = new HttpHeaders({ 'x-observatory': '1' });
const HTTP_NO_ANSWER = 0;
const HTTP_FORBIDDEN = 403;
const NO_ANSWER = 'the site didn’t answer';
const NOT_HERE = 'it isn’t available here';
const answered = (status: number): string => `the site answered ${status}`;

function parsed(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** The `error` words of an error answer, which may arrive as bytes, since
 *  the request asked for audio. */
function wordsIn(body: unknown): string | null {
  const text = body instanceof ArrayBuffer ? new TextDecoder().decode(body) : body;
  const said = typeof text === 'string' ? parsed(text) : text;
  const words: unknown = typeof said === 'object' && said ? Reflect.get(said, 'error') : null;
  return typeof words === 'string' && words !== '' ? words : null;
}

function refusalOf(error: unknown): unknown {
  if (!(error instanceof HttpErrorResponse)) return error;
  if (error.status === HTTP_NO_ANSWER) return new ElevenLabsRefusal(NO_ANSWER);
  if (error.status === HTTP_FORBIDDEN) return new ElevenLabsRefusal(NOT_HERE);
  return new ElevenLabsRefusal(wordsIn(error.error) ?? answered(error.status));
}

/** ElevenLabs behind Observatory's own API, which holds the key. */
@Injectable({ providedIn: 'root' })
export class HttpElevenLabsSpeech implements ElevenLabsSpeech {
  private readonly http = inject(HttpClient);

  async speak(request: SpeechRequest): Promise<ArrayBuffer> {
    const sound = this.http.post(SPEAK_URL, request, {
      headers: WRITE_HEADERS,
      responseType: 'arraybuffer',
    });
    try {
      return await firstValueFrom(sound);
    } catch (error: unknown) {
      throw refusalOf(error);
    }
  }
}

export const ELEVENLABS_SPEECH = new InjectionToken<ElevenLabsSpeech>('ElevenLabsSpeech', {
  providedIn: 'root',
  factory: () => inject(HttpElevenLabsSpeech),
});
