/** A repository file published as one wiki page. */
export interface WikiPage {
  /** Repository path, forward slashes, e.g. `docs/tech-stack.md`. */
  readonly source: string;
  /** Wiki page name, which is also its file name without `.md`. */
  readonly name: string;
  /** Shown in the sidebar. */
  readonly title: string;
  /** Pages listed under another page in the sidebar name it here. */
  readonly parent?: string;
}

/** Where the documentation lives, and the decision records inside it. */
export const DOCS_FOLDER = 'docs';
export const DECISIONS_FOLDER = `${DOCS_FOLDER}/decisions`;
const DECISIONS_PAGE = 'Decisions';
const GUIDE_PAGE = 'Guide';

/** What a visitor reads first; the agent workflow docs stay in the repository. */
const MAIN_PAGES: readonly WikiPage[] = [
  { source: 'README.md', name: 'Home', title: 'Home' },
  { source: 'docs/guide.md', name: GUIDE_PAGE, title: 'Guide' },
  { source: 'docs/tech-stack.md', name: 'Tech-stack', title: 'Tech stack' },
  { source: 'docs/sky-visuals.md', name: 'Sky-visuals', title: 'Sky visuals' },
  { source: 'CHANGELOG.md', name: 'Changelog', title: 'Changelog' },
  { source: `${DECISIONS_FOLDER}/README.md`, name: DECISIONS_PAGE, title: 'Decisions' },
];

/** A numbered record such as `0007-squash-merge-pull-requests.md`; `0000` is the template. */
const DECISION_FILE = /^(?!0000-)(\d{4})-[a-z0-9-]+\.md$/;
/** A cheat sheet such as `git-cheat-sheet.md`, found by its name so a new one needs no code here. */
const CHEAT_SHEET_FILE = /^[a-z0-9-]+-cheat-sheet\.md$/;
const HEADING = /^#\s+(.+?)\s*$/m;

/** A markdown file's first top-level heading, or null when it has none. */
export const firstHeading = (markdown: string): string | null =>
  HEADING.exec(markdown)?.[1] ?? null;

/** One markdown file read from a folder: its name there and its text. */
export interface MarkdownFile {
  readonly fileName: string;
  readonly markdown: string;
}

/**
 * Every page to publish: the main pages, each cheat sheet under the Guide, then each
 * decision record in number order. The files are those of `docs/decisions` and `docs`.
 */
export function wikiPages(
  decisionFiles: readonly MarkdownFile[],
  docFiles: readonly MarkdownFile[],
): readonly WikiPage[] {
  const cheatSheets = inNameOrder(docFiles, CHEAT_SHEET_FILE).map(cheatSheetPage);
  const decisions = inNameOrder(decisionFiles, DECISION_FILE).map(decisionPage);
  return [...MAIN_PAGES, ...cheatSheets, ...decisions];
}

const inNameOrder = (files: readonly MarkdownFile[], pattern: RegExp): MarkdownFile[] =>
  files
    .filter(({ fileName }) => pattern.test(fileName))
    .toSorted((a, b) => a.fileName.localeCompare(b.fileName));

function cheatSheetPage({ fileName, markdown }: MarkdownFile): WikiPage {
  const stem = fileName.replace(/\.md$/, '');
  const name = stem.charAt(0).toUpperCase() + stem.slice(1);
  return {
    source: `${DOCS_FOLDER}/${fileName}`,
    name,
    title: firstHeading(markdown) ?? name,
    parent: GUIDE_PAGE,
  };
}

function decisionPage({ fileName, markdown }: MarkdownFile): WikiPage {
  const stem = fileName.replace(/\.md$/, '');
  return {
    source: `${DECISIONS_FOLDER}/${fileName}`,
    name: `ADR-${stem}`,
    title: firstHeading(markdown) ?? `ADR-${stem}`,
    parent: DECISIONS_PAGE,
  };
}
