import { ProjectSnapshot } from '../../../core/projects/project.types';
import { QueueDirective } from '../../../core/projects/projects-report';
import { directiveListFrom } from './directive-list';

const quiet = { conflicted: 0, failing: 0, unknown: 0, unlinked: 0, unreviewed: 0, unclaimed: 0 };
const project = (name: string, error?: string): ProjectSnapshot => ({
  name,
  repo: `me/${name}`,
  dashboardUrl: `/p/me/${name}`,
  open: 0,
  counts: quiet,
  ...(error ? { error } : {}),
});
const blocked: QueueDirective = {
  project: 'alpha',
  number: 12,
  title: 'Split the pages',
  url: 'https://github.com/me/alpha/pull/12',
  bucket: 'conflicted',
};
const ready = (projects: ProjectSnapshot[], directives: QueueDirective[]) =>
  ({ status: 'ready', report: { generatedAt: 'x', projects, directives } }) as const;

describe('directiveListFrom', () => {
  it('lists each directive with its link, project, number and state', () => {
    const list = directiveListFrom(ready([project('alpha')], [blocked]));

    expect(list).toEqual({
      items: [
        {
          title: 'Split the pages',
          href: 'https://github.com/me/alpha/pull/12',
          detail: 'alpha #12 · cannot merge',
          color: 'var(--count-conflicted)',
        },
      ],
      note: 'Blocked first · on GitHub',
    });
  });

  it('says which projects could not be read, since they might outrank these', () => {
    const list = directiveListFrom(ready([project('alpha'), project('beta', 'down')], [blocked]));

    expect(list.note).toBe('1 project unreadable');
  });

  it('says nothing is open only when every project was read', () => {
    expect(directiveListFrom(ready([project('alpha')], [])).note).toBe('Nothing open');
    expect(directiveListFrom(ready([project('beta', 'down')], [])).note).toBe(
      '1 project unreadable · unknown',
    );
  });

  it('says it is reading, or out of reach, with no items', () => {
    expect(directiveListFrom({ status: 'reading' })).toEqual({
      items: [],
      note: 'Reading the queues',
    });
    expect(directiveListFrom({ status: 'unreachable' }).note).toBe('API out of reach · unknown');
  });
});
