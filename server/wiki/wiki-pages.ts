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

/** Where the decision records live, and the index page they hang under. */
export const DECISIONS_FOLDER = 'docs/decisions';
const DECISIONS_PAGE = 'Decisions';

/** What a visitor reads first; the agent workflow docs stay in the repository. */
const MAIN_PAGES: readonly WikiPage[] = [
  { source: 'README.md', name: 'Home', title: 'Home' },
  { source: 'docs/tech-stack.md', name: 'Tech-stack', title: 'Tech stack' },
  { source: 'docs/sky-visuals.md', name: 'Sky-visuals', title: 'Sky visuals' },
  { source: 'CHANGELOG.md', name: 'Changelog', title: 'Changelog' },
  { source: `${DECISIONS_FOLDER}/README.md`, name: DECISIONS_PAGE, title: 'Decisions' },
];

/** A numbered record such as `0007-squash-merge-pull-requests.md`; `0000` is the template. */
const DECISION_FILE = /^(?!0000-)(\d{4})-[a-z0-9-]+\.md$/;
const HEADING = /^#\s+(.+?)\s*$/m;

/** A markdown file's first top-level heading, or null when it has none. */
export const firstHeading = (markdown: string): string | null =>
  HEADING.exec(markdown)?.[1] ?? null;

/** One decision file read from disk: its name in the decisions folder and its text. */
export interface DecisionFile {
  readonly fileName: string;
  readonly markdown: string;
}

/** Every page to publish: the main pages, then each decision record in number order. */
export function wikiPages(decisionFiles: readonly DecisionFile[]): readonly WikiPage[] {
  const decisions = decisionFiles
    .filter(({ fileName }) => DECISION_FILE.test(fileName))
    .toSorted((a, b) => a.fileName.localeCompare(b.fileName))
    .map(decisionPage);
  return [...MAIN_PAGES, ...decisions];
}

function decisionPage({ fileName, markdown }: DecisionFile): WikiPage {
  const stem = fileName.replace(/\.md$/, '');
  return {
    source: `${DECISIONS_FOLDER}/${fileName}`,
    name: `ADR-${stem}`,
    title: firstHeading(markdown) ?? `ADR-${stem}`,
    parent: DECISIONS_PAGE,
  };
}
