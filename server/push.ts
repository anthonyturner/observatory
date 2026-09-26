// Carries what only this machine knows up to the hosted site, and brings the
// hosted page's triage home:
//
//   npm run push -- --site=https://<your site> --token=<PUSH_TOKEN>   remember them, then push
//   npm run push                                                      every repository Home charts
//   npm run push -- --repo=<owner/name>                               one repository
import { fileCloneFinder } from './collisions/clone-finder.ts';
import { collisionsReport } from './collisions/collisions-report.ts';
import { gitPairMerger } from './collisions/pair-merger.ts';
import { ghCliReader } from './github/gh-cli-reader.ts';
import { fileHistoryStore } from './history/history-store.ts';
import { pushClient } from './push/push-client.ts';
import { pushAll } from './push/push-run.ts';
import { PUSH_TARGET_KEY, argOf, namesTarget, pushTargetFrom } from './push/push-target.ts';
import { repoNameFrom } from './queue/repo-name.ts';
import { fileStore } from './store/file-store.ts';
import { storeTriageStore } from './triage/triage-store.ts';
import { usageReport } from './usage/usage-report.ts';

const args = process.argv.slice(2);
const local = fileStore();
const target = pushTargetFrom(args, process.env, await local.get(PUSH_TARGET_KEY));
if (!target) {
  console.error(
    'No site to push to. Run: npm run push -- --site=https://<your site> --token=<PUSH_TOKEN>',
  );
  process.exit(1);
}
if (namesTarget(args)) await local.set(PUSH_TARGET_KEY, target);

const github = ghCliReader();
const clones = fileCloneFinder();
const merger = gitPairMerger();
const only = argOf(args, 'repo');
const results = await pushAll(
  {
    client: pushClient(target),
    repos: async () =>
      (await github.ownedRepos(await github.viewer())).map((repo) => repo.nameWithOwner),
    triage: storeTriageStore(local),
    history: fileHistoryStore(),
    collisions: (repo) => collisionsReport(github, clones, merger, repo),
    usage: () => usageReport(),
  },
  only ? repoNameFrom(only) : null,
);
console.log(JSON.stringify({ site: target.site, results }, null, 2));
if (results.some((result) => 'error' in result)) process.exitCode = 1;
