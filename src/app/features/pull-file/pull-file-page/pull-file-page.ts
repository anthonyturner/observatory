import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, RouterLink, convertToParamMap } from '@angular/router';
import { diffFilesOf, pathPartsOf } from '../../../core/queue/diff-files';
import { PullFile } from '../../../core/queue/pull-file';
import { PullFileAsk, PullFileFeed } from '../../../core/queue/pull-file-feed';
import { WholeFile, wholeFileOf } from '../../../core/queue/whole-file';
import { DiffLines } from '../../../shared/diff-lines/diff-lines';
import { DiffWrapToggle } from '../../../shared/diff-wrap-toggle/diff-wrap-toggle';
import { ProjectBarRoom } from '../../../shared/project-bar-room/project-bar-room';
import {
  CHANGES_UNAVAILABLE_LABEL,
  CHANGES_UNAVAILABLE_NOTE,
  FileMessage,
  MISMATCH_NOTE,
  NOT_A_FILE,
  changeLabel,
  shortSha,
  stateMessage,
} from './pull-file-words';

/** The whole hash: a short one never equals the head's, so it would always look out of date. */
const COMMIT = /^[0-9a-f]{40}$/i;

const sameAsk = (a: PullFileAsk | null, b: PullFileAsk | null): boolean =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.repo === b.repo &&
    a.number === b.number &&
    a.sha === b.sha &&
    a.path === b.path);

/** What the address asks for, or null when it does not name a file of a pull request. */
function askOf(params: ParamMap, query: ParamMap): PullFileAsk | null {
  const [owner, name] = [params.get('owner'), params.get('repo')];
  const number = Number(params.get('number'));
  const [sha, path] = [query.get('sha'), query.get('path')];
  if (!owner || !name || !Number.isInteger(number) || number < 1) return null;
  if (!sha || !COMMIT.test(sha) || !path) return null;
  return { repo: `${owner}/${name}`, number, sha: sha.toLowerCase(), path };
}

/** Where the file was before a rename, read from the changes' own header. */
function renamedFromOf(file: PullFile): string | null {
  const section = diffFilesOf(file.patch)[0];
  return section && section.newPath === file.path && section.path !== file.path
    ? section.path
    : null;
}

/**
 * One file of a pull request, in full, at the commit the link named: the lines the
 * pull request added marked, the ones it removed shown where they were, and the changes
 * stepped through one at a time. It is a page of its own, so a link can open it in a new tab.
 */
@Component({
  selector: 'app-pull-file-page',
  imports: [RouterLink, ProjectBarRoom, DiffLines, DiffWrapToggle],
  providers: [PullFileFeed],
  templateUrl: './pull-file-page.html',
  styleUrls: ['../../releases/releases-page/releases-page.css', './pull-file-page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PullFilePage {
  private readonly feed = inject(PullFileFeed);
  private readonly route = inject(ActivatedRoute);

  private readonly params = toSignal(this.route.paramMap, { initialValue: convertToParamMap({}) });
  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: convertToParamMap({}),
  });
  private readonly ask = computed(() => askOf(this.params(), this.query()), {
    equal: sameAsk,
  });

  private readonly file = computed((): PullFile | null => {
    const state = this.feed.state();
    return state.status === 'ready' ? state.file : null;
  });
  private readonly whole = computed((): WholeFile | null => {
    const file = this.file();
    return file?.state === 'shown' ? wholeFileOf(file.text, file.patch) : null;
  });
  /** Which change the window was last brought to; the first one on arrival. */
  private readonly changeIndex = linkedSignal<WholeFile | null, number>({
    source: this.whole,
    computation: () => 0,
  });
  private readonly changeCount = computed(() => this.whole()?.changes.length ?? 0);

  protected readonly message = computed((): FileMessage | null =>
    this.ask() ? stateMessage(this.feed.state()) : NOT_A_FILE,
  );
  protected readonly lines = computed(() => this.whole()?.lines ?? null);
  private readonly isUnavailable = computed(() => this.file()?.changesUnavailable ?? false);
  /** Why no change is marked, when that is not because there are none. */
  protected readonly changesNote = computed((): string | null => {
    if (this.isUnavailable()) return CHANGES_UNAVAILABLE_NOTE;
    return this.whole()?.isMismatched ? MISMATCH_NOTE : null;
  });
  protected readonly reveal = computed(() => this.whole()?.changes[this.changeIndex()] ?? null);
  protected readonly hasPrevious = computed(() => this.changeIndex() > 0);
  protected readonly hasNext = computed(() => this.changeIndex() < this.changeCount() - 1);
  protected readonly changeText = computed(() =>
    this.isUnavailable()
      ? CHANGES_UNAVAILABLE_LABEL
      : changeLabel(this.changeIndex(), this.changeCount()),
  );

  /** The file's name large, its folder beneath, and where to go back to. */
  protected readonly head = computed(() => {
    const ask = this.ask();
    if (!ask) return null;
    const file = this.file();
    const { folder, name } = pathPartsOf(ask.path);
    return {
      name,
      folder,
      stamp: `${ask.repo} · commit ${shortSha(ask.sha)}`,
      number: ask.number,
      path: ask.path,
      pullLink: ['/p', ...ask.repo.split('/')],
      githubUrl: file?.githubUrl ?? null,
      renamedFrom: file ? renamedFromOf(file) : null,
      latest: file && file.headOid !== file.sha ? file.headOid : null,
    };
  });

  constructor() {
    effect(() => {
      const ask = this.ask();
      if (ask) this.feed.load(ask);
    });
  }

  protected previous(): void {
    this.changeIndex.update((index) => index - 1);
  }

  protected next(): void {
    this.changeIndex.update((index) => index + 1);
  }
}
