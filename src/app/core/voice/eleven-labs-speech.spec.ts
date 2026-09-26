import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ELEVENLABS_SPEECH, ElevenLabsRefusal } from './eleven-labs-speech';

const REQUEST = { text: 'Voice check.', voice: 'rachel01' };
/** Copied into this realm's ArrayBuffer, which the testing backend checks for. */
function bytesOf(text: string): ArrayBuffer {
  const encoded = new TextEncoder().encode(text);
  const bytes = new Uint8Array(new ArrayBuffer(encoded.length));
  bytes.set(encoded);
  return bytes.buffer;
}

function setUp() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return { speech: TestBed.inject(ELEVENLABS_SPEECH), http: TestBed.inject(HttpTestingController) };
}

describe('HttpElevenLabsSpeech', () => {
  it('posts one sentence with the write header and answers with the audio', async () => {
    const { speech, http } = setUp();
    const audio = new ArrayBuffer(8);

    const spoken = speech.speak(REQUEST);
    const request = http.expectOne('/api/voice/speak');
    request.flush(audio);

    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('x-observatory')).toBe('1');
    expect(request.request.responseType).toBe('arraybuffer');
    expect(request.request.body).toEqual(REQUEST);
    expect(await spoken).toBe(audio);
  });

  it('refuses in the site’s own words, which come as bytes', async () => {
    const { speech, http } = setUp();

    const spoken = speech.speak(REQUEST);
    http.expectOne('/api/voice/speak').flush(bytesOf('{"error":"the key was refused"}'), {
      status: 502,
      statusText: 'Bad Gateway',
    });

    await expect(spoken).rejects.toEqual(new ElevenLabsRefusal('the key was refused'));
  });

  it('refuses a visitor to the hosted preview as not available here', async () => {
    const { speech, http } = setUp();

    const spoken = speech.speak(REQUEST);
    http
      .expectOne('/api/voice/speak')
      .flush(bytesOf('{"error":"forbidden"}'), { status: 403, statusText: 'Forbidden' });

    await expect(spoken).rejects.toEqual(new ElevenLabsRefusal('it isn’t available here'));
  });

  it('names the status when the answer carries no words', async () => {
    const { speech, http } = setUp();

    const spoken = speech.speak(REQUEST);
    http
      .expectOne('/api/voice/speak')
      .flush(bytesOf('<html>'), { status: 500, statusText: 'Server Error' });

    await expect(spoken).rejects.toEqual(new ElevenLabsRefusal('the site answered 500'));
  });

  it('says so when the site does not answer', async () => {
    const { speech, http } = setUp();

    const spoken = speech.speak(REQUEST);
    http.expectOne('/api/voice/speak').error(new ProgressEvent('error'));

    await expect(spoken).rejects.toEqual(new ElevenLabsRefusal('the site didn’t answer'));
  });
});
