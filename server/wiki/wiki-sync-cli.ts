// Writes the wiki pages generated from /docs into a folder:
//
//   npm run wiki:sync                      a preview in dist/wiki, to read before it goes live
//   npm run wiki:sync -- --out=<folder>    a clone of the wiki repository; CI commits and pushes it
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { argOf } from '../push/push-target.ts';
import { planSync } from './wiki-plan.ts';
import { DECISIONS_FOLDER, wikiPages, type DecisionFile, type WikiPage } from './wiki-pages.ts';
import { SIDEBAR_NAME, renderPage, renderSidebar } from './wiki-render.ts';
import type { RepoLinks } from './wiki-links.ts';

const PREVIEW_FOLDER = 'dist/wiki';
const DEFAULT_REPOSITORY = 'anthonyturner/observatory';
const BRANCH = 'main';
const PAGE_EXTENSION = '.md';

const args = process.argv.slice(2);
const out = argOf(args, 'out') ?? PREVIEW_FOLDER;
const repo: RepoLinks = {
  repoUrl: `https://github.com/${process.env['GITHUB_REPOSITORY'] ?? DEFAULT_REPOSITORY}`,
  branch: BRANCH,
};

async function decisionFiles(): Promise<DecisionFile[]> {
  const fileNames = await readdir(DECISIONS_FOLDER);
  return Promise.all(
    fileNames.map(async (fileName) => ({
      fileName,
      markdown: await readFile(join(DECISIONS_FOLDER, fileName), 'utf8'),
    })),
  );
}

async function generatedPages(pages: readonly WikiPage[]): Promise<Map<string, string>> {
  const pageBySource = new Map(pages.map((page) => [page.source, page.name]));
  const generated = new Map<string, string>();
  for (const page of pages) {
    const markdown = await readFile(page.source, 'utf8');
    generated.set(
      page.name,
      renderPage(page, markdown, { ...repo, source: page.source, pageBySource }),
    );
  }
  generated.set(SIDEBAR_NAME, renderSidebar(pages, repo));
  return generated;
}

async function currentPages(folder: string): Promise<Map<string, string>> {
  const fileNames = (await readdir(folder)).filter((name) => name.endsWith(PAGE_EXTENSION));
  const entries = await Promise.all(
    fileNames.map(
      async (fileName) =>
        [
          fileName.slice(0, -PAGE_EXTENSION.length),
          await readFile(join(folder, fileName), 'utf8'),
        ] as const,
    ),
  );
  return new Map(entries);
}

const pageFile = (name: string): string => join(out, name + PAGE_EXTENSION);

await mkdir(out, { recursive: true });
const plan = planSync(
  await currentPages(out),
  await generatedPages(wikiPages(await decisionFiles())),
);
await Promise.all([...plan.write].map(([name, content]) => writeFile(pageFile(name), content)));
await Promise.all(plan.remove.map((name) => unlink(pageFile(name))));

console.log(`Wrote ${plan.write.size} wiki pages to ${out}.`);
if (plan.remove.length)
  console.log(`Removed pages no longer published: ${plan.remove.join(', ')}.`);
/** Shown as a warning on the run in GitHub Actions, rather than only in its log. */
const warningPrefix = process.env['GITHUB_ACTIONS'] === 'true' ? '::warning::' : '';
if (plan.kept.length) {
  console.warn(
    `${warningPrefix}Left hand-written pages alone, so their /docs versions were not published: ${plan.kept.join(', ')}.` +
      ' Rename or delete them on the wiki to let the sync publish these pages.',
  );
}
