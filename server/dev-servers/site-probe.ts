import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

/** Whether something answers an HTTP request at `url`. Never rejects: no answer is `false`. */
export type SiteProbe = (url: string) => Promise<boolean>;

/** A site that does not answer within this long is not up yet. */
const ANSWER_LIMIT_MS = 2_000;

/**
 * Sends one GET. Any HTTP response counts, whatever its status, since a
 * dev server answers 404 or 500 while it is still building; a refused or
 * timed-out connection does not. The certificate is not checked: a
 * local site often has a self-signed one, and nothing is sent or read.
 */
export const answersHttp: SiteProbe = (url) =>
  new Promise((resolve) => {
    try {
      const send = url.startsWith('https:') ? httpsRequest : httpRequest;
      const call = send(url, {
        method: 'GET',
        timeout: ANSWER_LIMIT_MS,
        rejectUnauthorized: false,
      });
      call.once('response', (response) => {
        response.destroy();
        resolve(true);
      });
      call.once('timeout', () => call.destroy());
      call.once('error', () => resolve(false));
      call.end();
    } catch {
      resolve(false);
    }
  });
