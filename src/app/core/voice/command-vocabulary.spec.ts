import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ProjectSnapshot } from '../projects/project.types';
import { PROJECTS } from '../projects/projects-source';
import {
  COMMAND_VOCABULARY,
  VocabularyProject,
  commandVocabulary,
  whisperPromptOf,
} from './command-vocabulary';

const COMMAND_WORDS = ['Jev', 'crew', 'snooze', 'dismiss', 'pull request', 'PR', 'Next star'];

const OBSERVATORY: VocabularyProject = {
  name: 'Observatory',
  repo: 'anthonyturner/observatory',
  openPulls: [{ number: 412 }, { number: 508 }],
};
const STARMAP: VocabularyProject = {
  name: 'Starmap',
  repo: 'anthonyturner/pr-starmap',
  openPulls: [{ number: 7 }],
};

describe('commandVocabulary', () => {
  it('holds only the command words when there are no projects', () => {
    expect(commandVocabulary([])).toEqual(COMMAND_WORDS);
  });

  it('adds project and repository names, then open pull requests, after the command words', () => {
    expect(commandVocabulary([OBSERVATORY, STARMAP])).toEqual([
      ...COMMAND_WORDS,
      'Observatory',
      'Starmap',
      'pr-starmap',
      'PR 412',
      'PR 508',
      'PR 7',
    ]);
  });

  it('keeps each term once, whatever its case', () => {
    const twice: VocabularyProject = { name: 'crew', repo: 'me/Crew', openPulls: [{ number: 7 }] };
    const terms = commandVocabulary([twice, STARMAP]);
    expect(terms.filter((term) => term.toLowerCase() === 'crew')).toEqual(['crew']);
    expect(terms.filter((term) => term === 'PR 7')).toEqual(['PR 7']);
  });

  it('tidies spacing and skips blank names', () => {
    const untidy: VocabularyProject = { name: '  Review   Queue ', repo: 'me/' };
    expect(commandVocabulary([untidy]).slice(COMMAND_WORDS.length)).toEqual(['Review Queue']);
  });

  it('treats a project with unknown pull requests as having none', () => {
    const unread: VocabularyProject = { name: 'Atlas', repo: 'me/atlas' };
    expect(commandVocabulary([unread]).slice(COMMAND_WORDS.length)).toEqual(['Atlas']);
  });
});

describe('whisperPromptOf', () => {
  it('reads the vocabulary as one sentence', () => {
    expect(whisperPromptOf(['Jev', 'crew', 'PR 412'])).toBe('Jev, crew, PR 412.');
  });

  it('is empty for no words', () => {
    expect(whisperPromptOf([])).toBe('');
  });
});

describe('COMMAND_VOCABULARY', () => {
  it('follows the projects as they are read', () => {
    const projects = signal<readonly ProjectSnapshot[]>([]);
    TestBed.configureTestingModule({ providers: [{ provide: PROJECTS, useValue: projects }] });
    const vocabulary = TestBed.inject(COMMAND_VOCABULARY);
    expect(vocabulary()).toEqual(COMMAND_WORDS);

    projects.set([snapshotOf(OBSERVATORY)]);
    expect(vocabulary()).toContain('PR 508');
  });
});

function snapshotOf(project: VocabularyProject): ProjectSnapshot {
  return {
    name: project.name,
    repo: project.repo,
    dashboardUrl: '',
    open: project.openPulls?.length ?? 0,
    counts: { conflicted: 0, failing: 0, unknown: 0, unlinked: 0, unreviewed: 0, unclaimed: 0 },
    openPulls: (project.openPulls ?? []).map(({ number }) => ({ number, title: null, closes: [] })),
  };
}
