import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SOUND_CARD_AVAILABLE } from './sound-card-availability';

function setup() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  const available = TestBed.inject(SOUND_CARD_AVAILABLE);
  const http = TestBed.inject(HttpTestingController);
  return { available, request: () => http.expectOne('/api/sound-card') };
}

describe('SOUND_CARD_AVAILABLE', () => {
  it('is false until the local API answers', () => {
    const { available, request } = setup();

    expect(available()).toBe(false);
    request();
  });

  it('is true when the local API says it can capture the sound card', () => {
    const { available, request } = setup();

    request().flush({ available: true });

    expect(available()).toBe(true);
  });

  it('is false when it says it cannot', () => {
    const { available, request } = setup();

    request().flush({ available: false });

    expect(available()).toBe(false);
  });

  it('is false where there is no such route, as on the hosted site', () => {
    const { available, request } = setup();

    request().flush({ error: 'not found' }, { status: 404, statusText: 'Not Found' });

    expect(available()).toBe(false);
  });
});
