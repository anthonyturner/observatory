import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Forbidden } from '../http/api-handler.ts';
import { ProposalBook } from './proposals.ts';

const APP = { name: 'app', repo: 'me/app', folder: 'E:/repos/app' };
const TERMS = { proposalMs: 1_000, runMs: 60_000, offers: 2, command: 'claude -p' };

describe('ProposalBook', () => {
  it('lets a token stand until it is spent', () => {
    const book = new ProposalBook(TERMS, () => 0);
    const { token } = book.issue('Do it', APP);
    const request = { token, prompt: 'Do it', folder: APP.folder };

    assert.equal(book.vet(request).prompt, 'Do it');
    assert.equal(book.vet(request).folder, APP.folder);
    book.spend(token);
    assert.throws(() => book.vet(request), Forbidden);
  });

  it('drops the oldest waiting token when too many wait', () => {
    const book = new ProposalBook(TERMS, () => 0);
    const [first, second, third] = ['a', 'b', 'c'].map((prompt) => book.issue(prompt, APP));

    assert.throws(
      () => book.vet({ token: first?.token ?? '', prompt: 'a', folder: APP.folder }),
      Forbidden,
    );
    assert.ok(book.vet({ token: second?.token ?? '', prompt: 'b', folder: APP.folder }));
    assert.ok(book.vet({ token: third?.token ?? '', prompt: 'c', folder: APP.folder }));
  });

  it('never hands out the same token twice', () => {
    const book = new ProposalBook({ ...TERMS, offers: 100 }, () => 0);
    const tokens = new Set(Array.from({ length: 50 }, () => book.issue('x', APP).token));

    assert.equal(tokens.size, 50);
  });
});
