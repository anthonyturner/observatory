import { IssueNarrowing, issueMatches } from '../../issues/issue-list';
import { SkyEngine } from '../engine/sky-engine';
import { SkyLayout } from '../engine/sky-layout';
import { SkyStar } from '../engine/sky-model';
import { NurseryLayer } from './nursery-layer';
import { NurseryInput, bodyOf, layoutIssues } from './nursery-layout';

const numberOf = (star: SkyStar | null): number | null => bodyOf(star)?.issue.number ?? null;

/**
 * The nursery on the star map engine: lays the disk out, narrows it as the
 * issue bar does, and keeps the hovered body across a relayout.
 */
export class NurserySky {
  readonly layer: NurseryLayer;
  /** The tab last laid out; another tab is a new disk, which arrives afresh. */
  private closedTab: boolean | null = null;
  private cometsOnly = false;

  constructor(document: Document) {
    this.layer = new NurseryLayer(document);
  }

  /** Lays the disk out: a refresh of the same tab glides, another tab arrives
   *  afresh. Says whether it was another tab, which wants a Fit. */
  layOut(engine: SkyEngine, input: NurseryInput | null, carry: boolean): boolean {
    const closedTab = input?.closedTab ?? null;
    const changed = closedTab !== this.closedTab;
    this.closedTab = closedTab;
    const hovered = numberOf(this.layer.hovered);
    engine.setSky((sky: SkyLayout) => this.layer.setNursery(input && layoutIssues(input, sky)), {
      carry: carry && !changed,
    });
    this.layer.hovered =
      hovered === null ? null : (engine.skyStars.find((s) => numberOf(s) === hovered) ?? null);
    return changed;
  }

  /** Leaves the sky: nothing of the disk is drawn on another. */
  clear(): void {
    this.layer.setNursery(null);
    this.closedTab = null;
  }

  /** Label and search dim what does not match and light the label's arm; the
   *  comets alone also narrow what Fit frames. Says whether the comets were
   *  switched, which pr-starmap draws as a new disk. */
  narrow(engine: SkyEngine, narrowing: IssueNarrowing): boolean {
    const { label, query, cometsOnly } = narrowing;
    engine.filter =
      label || query.trim() || cometsOnly
        ? (star) => {
            const body = bodyOf(star);
            return !body || issueMatches(body.issue, narrowing);
          }
        : null;
    engine.fitsFiltered = cometsOnly;
    this.layer.litLabel = label;
    const switched = cometsOnly !== this.cometsOnly;
    this.cometsOnly = cometsOnly;
    return switched;
  }

  /** The body of the issue whose card is open. */
  selected(engine: SkyEngine, number: number | null): SkyStar | null {
    return number === null ? null : (engine.skyStars.find((s) => numberOf(s) === number) ?? null);
  }

  /** The body under the pointer, named while it is there; says whether it changed. */
  hover(engine: SkyEngine, x: number | null, y: number | null): boolean {
    const star = x === null || y === null ? null : engine.pick(x, y);
    if (star === this.layer.hovered) return false;
    this.layer.hovered = star;
    return true;
  }

  get isHovering(): boolean {
    return this.layer.hovered !== null;
  }
}
