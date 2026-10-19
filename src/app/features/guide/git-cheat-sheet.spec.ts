import { TestBed } from '@angular/core/testing';
import { DOCS_BOOKS } from '../../core/guide/docs-books';
import { guideOf } from '../../core/guide/guide';
import { DocBlock } from '../../core/library/doc.types';

const book = TestBed.inject(DOCS_BOOKS).find((candidate) => candidate.slug === 'git-cheat-sheet');
const cheatSheet = guideOf(book?.markdown ?? '');
const sections = cheatSheet.parts.flatMap((part) => part.sections);

/** The bold lead-ins of a section's paragraphs, such as "Everyday comparison". */
const leadInsOf = (blocks: readonly DocBlock[]): string[] =>
  blocks.flatMap((block) =>
    block.kind === 'p'
      ? block.spans.flatMap((span) =>
          span.kind === 'text' && span.strong ? [span.text.replace(/:$/, '')] : [],
        )
      : [],
  );

/** A command's entry opens with the command itself; an explainer opens with prose. */
const isCommand = (section: { readonly blocks: readonly DocBlock[] }): boolean =>
  section.blocks.find((block) => block.kind !== 'heading')?.kind === 'pre';

describe('the Git cheat sheet', () => {
  it('has the parts a learner reaches for, in order', () => {
    expect(cheatSheet.parts.map((part) => part.title)).toEqual([
      'Get up to date',
      'When a merge goes wrong',
      'Everyday basics',
      'Branches',
      'Undo safely',
      'Worktrees',
      'Danger zone',
    ]);
  });

  it('explains the Diverging branches error and its fix', () => {
    const error = sections.find((section) => section.title.startsWith('The error'));

    expect(error?.text).toContain("Diverging branches can't be fast-forwarded");
    expect(error?.text).toContain('fatal: Not possible to fast-forward, aborting.');
    expect(error?.text).toContain('git merge origin/main');
    expect(error?.text).toContain('git pull --no-ff --tags origin main');
  });

  it('shows how to catch up with a fast-forward only', () => {
    const fastForward = sections.find((section) => section.title.startsWith('Fast-forward only'));

    expect(fastForward?.text).toContain('git pull --ff-only origin main');
    expect(fastForward?.text).toContain('git merge --ff-only');
  });

  it('gives each safe command a table of its pieces, what happens to files and an everyday comparison', () => {
    const commands = cheatSheet.parts
      .filter((part) => part.title !== 'Danger zone')
      .flatMap((part) => part.sections)
      .filter(isCommand);
    const incomplete = commands
      .filter((section) => {
        const leadIns = leadInsOf(section.blocks);
        return (
          !section.blocks.some((block) => block.kind === 'table') ||
          !leadIns.includes('What happens to your files') ||
          !leadIns.includes('Everyday comparison')
        );
      })
      .map((section) => section.title);

    expect(commands.length).toBeGreaterThan(15);
    expect(incomplete).toEqual([]);
  });

  it('warns that the stash is shared and recommends a work-in-progress commit', () => {
    const stash = sections.find((section) => section.title === 'The stash is shared');

    expect(stash?.text).toContain('shared by every worktree');
    expect(stash?.text).toContain('wip');
  });

  it('keeps the commands that lose work in the danger zone', () => {
    const danger = cheatSheet.parts.find((part) => part.title === 'Danger zone');
    const risky = /push --force|reset --hard|branch -D|clean -fd/;
    const strayed = cheatSheet.parts
      .filter((part) => part !== danger)
      .flatMap((part) => part.sections)
      .filter((section) =>
        section.blocks.some((block) => block.kind === 'pre' && risky.test(block.code)),
      );

    expect(danger?.sections.map((section) => section.title)).toEqual([
      'Force-push: overwrite GitHub',
      'Reset --hard: throw away work',
      'Delete a branch',
      'Clean: delete untracked files',
      'Rewriting history',
      'If something looks lost',
    ]);
    expect(strayed.map((section) => section.title)).toEqual([]);
    expect(
      danger?.sections
        .filter(isCommand)
        .filter((section) => !section.blocks.some((block) => block.kind === 'table'))
        .map((section) => section.title),
    ).toEqual([]);
  });
});
