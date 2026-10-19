import { GuideBook } from './guide-book';
import { GIT_CHEAT_SHEET_LINK } from './git-cheat-sheet-link';
// Bundled as text at build time, like the Guide's, so only its own lazy route carries it.
import cheatSheetMarkdown from '../../../../docs/git-cheat-sheet.md' with { loader: 'text' };

/** The Git cheat sheet, shown by the Guide page: `docs/git-cheat-sheet.md`. */
export const GIT_CHEAT_SHEET_BOOK: GuideBook = {
  title: 'Git cheat sheet',
  stamp: 'The Git commands you meet most, in plain English',
  name: 'the cheat sheet',
  link: GIT_CHEAT_SHEET_LINK,
  markdown: cheatSheetMarkdown,
};
