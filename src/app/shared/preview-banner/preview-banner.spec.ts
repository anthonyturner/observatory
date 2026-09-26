import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PAGE_LOCATION } from '../../core/session/viewer-session';
import { PreviewBanner } from './preview-banner';

function render(session: object) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: PAGE_LOCATION, useValue: { here: () => '/orrery', assign: () => undefined } },
    ],
  });
  const fixture = TestBed.createComponent(PreviewBanner);
  fixture.detectChanges();
  TestBed.inject(HttpTestingController).expectOne('/api/session').flush(session);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('PreviewBanner', () => {
  it('tells a visitor it is a read-only preview, with a sign-in link back to this page', () => {
    const link = render({ access: 'visitor', signIn: '/api/auth/login' }).querySelector('a');

    expect(link?.textContent).toBe('Preview · read-only · Sign in');
    expect(link?.getAttribute('href')).toBe('/api/auth/login?next=%2Forrery');
  });

  it('shows nothing to the owner or on this machine', () => {
    expect(render({ access: 'owner', signIn: '/api/auth/login' }).querySelector('a')).toBeNull();
    TestBed.resetTestingModule();
    expect(render({ access: 'local', signIn: null }).querySelector('a')).toBeNull();
  });
});
