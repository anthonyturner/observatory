import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpMailApi } from './mail-api';
import { MailAnswer } from './mail.types';

const OFF = { account: 'gmail', state: 'off', settings: ['GMAIL_ADDRESS'] };

function setUp() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const api = TestBed.inject(HttpMailApi);
  const http = TestBed.inject(HttpTestingController);
  const answers: MailAnswer[] = [];
  return { api, http, answers };
}

describe('HttpMailApi', () => {
  it('reads one inbox with the page’s own header, and gives its report', () => {
    const { api, http, answers } = setUp();

    api.read('gmail').subscribe((answer) => answers.push(answer));
    const request = http.expectOne((each) => each.url === '/api/mail');
    request.flush(OFF);

    expect(request.request.params.get('account')).toBe('gmail');
    expect(request.request.params.has('refresh')).toBe(false);
    expect(request.request.headers.get('x-observatory')).toBe('1');
    expect(answers).toEqual([{ kind: 'report', report: OFF }]);
  });

  it('asks the mail server again on refresh', () => {
    const { api, http } = setUp();

    api.refresh('icloud').subscribe();
    const request = http.expectOne((each) => each.url === '/api/mail');

    expect(request.request.params.get('refresh')).toBe('1');
  });

  it('reads 401, 403 and 404 as no mail on this site', () => {
    const { api, http, answers } = setUp();

    for (const status of [401, 403, 404]) {
      api.read('icloud').subscribe((answer) => answers.push(answer));
      http.expectOne((each) => each.url === '/api/mail').flush(null, { status, statusText: 'No' });
    }

    expect(answers).toEqual([{ kind: 'absent' }, { kind: 'absent' }, { kind: 'absent' }]);
  });

  it('reads any other failure, or a body that is not a report, as no answer', () => {
    const { api, http, answers } = setUp();

    api.read('icloud').subscribe((answer) => answers.push(answer));
    http
      .expectOne((each) => each.url === '/api/mail')
      .flush(null, { status: 500, statusText: 'Down' });
    api.read('icloud').subscribe((answer) => answers.push(answer));
    http.expectOne((each) => each.url === '/api/mail').flush({ account: 'outlook' });

    expect(answers).toEqual([{ kind: 'unreachable' }, { kind: 'unreachable' }]);
  });
});
