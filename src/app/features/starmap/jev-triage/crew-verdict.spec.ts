import { Crew } from '../../../core/crew/crew.types';
import { QueueItem } from '../../../core/queue/queue-report';
import { LandedBase } from '../../../core/queue/stacks';
import { CrewStanding, CrewTarget, crewVerdictOf } from './crew-verdict';

const NAME = 'alpha pull request 12, “Fix login”';

const queueItem = (bucket: QueueItem['bucket']): QueueItem => ({
  number: 12,
  title: 'Fix login',
  url: 'https://github.com/me/alpha/pull/12',
  isDraft: false,
  bucket,
  closes: [],
  failingChecks: bucket === 'failing' ? 1 : 0,
  flakyChecks: [],
  additions: 400,
  deletions: 0,
  idleDays: 9,
  ageDays: 9,
  branch: 'fix-login',
  base: 'main',
  mergeable: bucket === 'conflicted' ? 'CONFLICTING' : 'MERGEABLE',
  changedFiles: 3,
  isSeen: false,
  hidden: null,
  lookedSha: null,
  sinceLook: null,
});

const LANDED: LandedBase = { number: 11, branch: 'auth-base', into: 'main' };
const UPDATE_STACK =
  'The pull request this one was stacked on has merged. A crew merges that work into this branch, points the pull request where it landed and pushes. It never merges the pull request.';

const target = (bucket: QueueItem['bucket'], landed: LandedBase | null = null): CrewTarget => ({
  item: queueItem(bucket),
  landed,
});

const working: Crew = {
  repo: 'me/alpha',
  number: 12,
  runId: 'run-1',
  phase: 'working',
  state: 'running',
  startedAt: 1,
  endedAt: null,
};

const FREE: CrewStanding = { crew: null, isSending: false, isRunnerBusy: false, refusal: null };

describe('crewVerdictOf', () => {
  it('asks to send a crew to a failing pull request, saying what it will do', () => {
    expect(crewVerdictOf(NAME, target('failing'), FREE)).toEqual({
      kind: 'send',
      question: `Send a crew to ${NAME}? A crew reads the failed checks, fixes them and pushes to this branch. It never merges the pull request.`,
    });
  });

  it('asks to send one to a conflicted pull request', () => {
    expect(crewVerdictOf(NAME, target('conflicted'), FREE)).toEqual(
      expect.objectContaining({ kind: 'send' }),
    );
  });

  it('offers to open one a crew has nothing to fix in, saying where it stands', () => {
    expect(crewVerdictOf(NAME, target('unreviewed'), FREE)).toEqual({
      kind: 'open',
      question: `A crew only takes a pull request that is failing, conflicted or stacked on a base that has merged, and this one isn’t: waiting on you, idle 9 days. Want me to open ${NAME} instead?`,
    });
  });

  it('asks to send a crew to one whose stacked base has merged, as the star card offers', () => {
    expect(crewVerdictOf(NAME, target('unreviewed', LANDED), FREE)).toEqual({
      kind: 'send',
      question: `Send a crew to ${NAME}? ${UPDATE_STACK}`,
    });
  });

  it('updates the stack first when the base has merged and the branch also conflicts', () => {
    expect(crewVerdictOf(NAME, target('conflicted', LANDED), FREE)).toEqual({
      kind: 'send',
      question: `Send a crew to ${NAME}? ${UPDATE_STACK}`,
    });
  });

  it('says one crew at a time while one is out', () => {
    expect(crewVerdictOf(NAME, target('failing'), { ...FREE, crew: working })).toEqual({
      kind: 'say',
      text: 'A crew is already working on this pull request: one crew at a time.',
    });
  });

  it('says the runner is busy while another task runs', () => {
    expect(crewVerdictOf(NAME, target('failing'), { ...FREE, isRunnerBusy: true })).toEqual({
      kind: 'say',
      text: 'Another task is running on this machine. A crew can launch once it ends.',
    });
  });

  it('says so when the pull request is no longer open', () => {
    expect(crewVerdictOf(NAME, undefined, FREE)).toEqual({
      kind: 'say',
      text: `That one isn’t open any more: ${NAME}.`,
    });
  });
});
