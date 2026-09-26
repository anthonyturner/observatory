import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { levelOf, parseLogLine, shapeMessage, windowOf } from './log-line.ts';

describe('parseLogLine', () => {
  it('reads the day, the time and the level of an Overwolf line', () => {
    assert.deepEqual(
      parseLogLine('﻿2026-09-23 01:43:37,307 (WARNING) <app.js> (:1) - [Api] slow'),
      {
        day: '2026-09-23',
        at: '2026-09-23T01:43:37',
        level: 'warn',
        rest: '<app.js> (:1) - [Api] slow',
      },
    );
  });

  it('skips a line without a timestamp: it continues the entry above', () => {
    assert.equal(parseLogLine('    at fetch (app.js:12:4)'), null);
  });
});

describe('levelOf', () => {
  it('folds the spellings into error, warn and info', () => {
    assert.deepEqual(['ERROR', 'err', 'FATAL', 'WARN', 'warning', 'INFO', 'DEBUG'].map(levelOf), [
      'error',
      'error',
      'error',
      'warn',
      'warn',
      'info',
      'info',
    ]);
  });
});

describe('shapeMessage', () => {
  it('strips the source, numbers, payloads and URL paths, and keeps the service', () => {
    assert.deepEqual(
      shapeMessage(
        '<main.js> (:1) - [MatchApi] player 123456 took 1.5s at https://api.example.com/v2/players/77?x=1 {"nick":"Someone"}',
      ),
      {
        service: 'MatchApi',
        text: '[MatchApi] player # took #s at https://api.example.com/… {…}',
      },
    );
  });

  it('drops a JSON array payload too', () => {
    assert.equal(shapeMessage('<a> (:1) - got [{"id":1}]').text, 'got {…}');
    assert.equal(shapeMessage('<a> (:1) - names ["Kim","Lee"]').text, 'names {…}');
  });

  it('cuts a long message with an ellipsis', () => {
    const { text } = shapeMessage(`<a> (:1) - ${'x'.repeat(400)}`);
    assert.equal(text.length, 220);
    assert.ok(text.endsWith('…'));
  });
});

describe('windowOf', () => {
  it('names a rotated file and its current one alike', () => {
    assert.equal(windowOf('desktop.html.1463.log'), 'desktop');
    assert.equal(windowOf('desktop.html.log'), 'desktop');
    assert.equal(windowOf('background.log'), 'background');
  });
});
