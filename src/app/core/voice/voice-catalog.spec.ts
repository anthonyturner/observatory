import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { VoiceCatalog } from './voice-catalog';
import { parseCatalog } from './voice-catalog-parse';

describe('parseCatalog', () => {
  it('reads ElevenLabs on, with its voices and default', () => {
    expect(
      parseCatalog({
        elevenlabs: 'on',
        voices: [{ id: 'rachel01', name: 'Rachel' }],
        defaultVoice: 'rachel01',
      }),
    ).toEqual({
      status: 'on',
      voices: [{ id: 'rachel01', name: 'Rachel' }],
      defaultVoice: 'rachel01',
      failed: null,
    });
  });

  it('keeps why the voices could not be listed', () => {
    const catalog = parseCatalog({
      elevenlabs: 'on',
      voices: [],
      defaultVoice: null,
      failed: 'the key was refused',
    });
    expect(catalog).toEqual(expect.objectContaining({ failed: 'the key was refused' }));
  });

  it('drops an odd voice rather than trusting it', () => {
    const catalog = parseCatalog({
      elevenlabs: 'on',
      voices: [{ id: 'adam02', name: 'Adam' }, { id: 7 }, 'Bella', null],
      defaultVoice: 'adam02',
    });
    expect(catalog).toEqual(expect.objectContaining({ voices: [{ id: 'adam02', name: 'Adam' }] }));
  });

  it('reads off as off', () => {
    expect(parseCatalog({ elevenlabs: 'off', voices: [], defaultVoice: null })).toEqual({
      status: 'off',
    });
  });

  it('takes anything else as ElevenLabs not available', () => {
    expect(parseCatalog({ hello: 'world' })).toEqual({ status: 'unavailable' });
    expect(parseCatalog('on')).toEqual({ status: 'unavailable' });
    expect(parseCatalog(null)).toEqual({ status: 'unavailable' });
  });
});

describe('VoiceCatalog', () => {
  function setUp() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    return { catalog: TestBed.inject(VoiceCatalog), http: TestBed.inject(HttpTestingController) };
  }

  it('reads the voices once, reading until the site answers', async () => {
    const { catalog, http } = setUp();
    expect(catalog.state()).toEqual({ status: 'reading' });

    http.expectOne('/api/voice').flush({ elevenlabs: 'off', voices: [], defaultVoice: null });

    expect(await catalog.whenRead).toEqual({ status: 'off' });
    expect(catalog.state()).toEqual({ status: 'off' });
    http.verify();
  });

  it('takes the hosted preview’s 403 as ElevenLabs not available, not an error', async () => {
    const { catalog, http } = setUp();

    http
      .expectOne('/api/voice')
      .flush({ error: 'forbidden' }, { status: 403, statusText: 'Forbidden' });

    expect(await catalog.whenRead).toEqual({ status: 'unavailable' });
  });

  it('takes a site that does not answer as ElevenLabs not available', async () => {
    const { catalog, http } = setUp();

    http.expectOne('/api/voice').error(new ProgressEvent('error'));

    expect(await catalog.whenRead).toEqual({ status: 'unavailable' });
  });
});
