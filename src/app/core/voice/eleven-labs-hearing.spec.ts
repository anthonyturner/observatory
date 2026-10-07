import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ElevenLabsHearing, HEAR_CLIP, HearClip, HearingFailed } from './eleven-labs-hearing';
import { ELEVENLABS_ON, fakeCatalog } from './testing/voice-catalog-fixture';
import { CatalogState } from './voice-catalog.types';

const CLIP = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' });
const KEYTERMS = ['Jev', 'PR 412'];

function setUp(state: CatalogState, hearClip: HearClip) {
  const catalog = fakeCatalog(state);
  TestBed.configureTestingModule({
    providers: [catalog.provider, { provide: HEAR_CLIP, useValue: hearClip }],
  });
  return TestBed.inject(ElevenLabsHearing);
}

describe('ElevenLabsHearing', () => {
  it('hears while ElevenLabs is on, returning its words', async () => {
    const hearClip = vi.fn(async () => 'open the orrery');
    const hearing = setUp(ELEVENLABS_ON, hearClip);
    expect(hearing.isAvailable()).toBe(true);
    expect(await hearing.hear(CLIP, KEYTERMS)).toBe('open the orrery');
    expect(hearClip).toHaveBeenCalledWith(CLIP, KEYTERMS);
  });

  it('is not available while ElevenLabs is off or unread', () => {
    expect(setUp({ status: 'off' }, async () => '').isAvailable()).toBe(false);
  });

  it('after a failure, says why and hands hearing to Whisper for the visit', async () => {
    const hearing = setUp(ELEVENLABS_ON, async () => {
      throw new HearingFailed('the key lacks the speech-to-text permission');
    });

    await expect(hearing.hear(CLIP, KEYTERMS)).rejects.toBeInstanceOf(HearingFailed);
    expect(hearing.isAvailable()).toBe(false);
    expect(hearing.failure()).toBe('the key lacks the speech-to-text permission');
  });

  it('turns any other failure into one it can name', async () => {
    const hearing = setUp(ELEVENLABS_ON, async () => {
      throw new Error('boom');
    });
    await expect(hearing.hear(CLIP, KEYTERMS)).rejects.toThrow('it failed');
    expect(hearing.isAvailable()).toBe(false);
  });
});

describe('HEAR_CLIP', () => {
  it('posts the recording with the keyterms to the site', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    const heard = TestBed.inject(HEAR_CLIP)(CLIP, KEYTERMS);

    const request = await vi.waitFor(() => http.expectOne('/api/voice/hear'));
    expect(request.request.body).toEqual({ audio: 'AQID', type: 'audio/webm', keyterms: KEYTERMS });
    request.flush({ text: 'dismiss PR 412' });
    expect(await heard).toBe('dismiss PR 412');
    http.verify();
  });
});
