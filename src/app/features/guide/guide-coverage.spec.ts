import { TestBed } from '@angular/core/testing';
import { guideOf } from '../../core/guide/guide';
import { GUIDE_MARKDOWN } from '../../core/guide/guide-markdown';
import { PROJECT_TABS, guidePartOf } from '../../shared/project-tabs/project-tabs';
import { HELP } from '../starmap/starmap-help/help-content';

/** The anchors screens and help cards link to that the tabs and help cards do not name. */
const SCREEN_ANCHORS = ['home', 'orrery', 'inbox', 'agents'];

/** Every part's and section's anchor in the real Guide. */
function guideAnchors(): ReadonlySet<string> {
  const guide = guideOf(TestBed.inject(GUIDE_MARKDOWN));
  return new Set(
    guide.parts.flatMap((part) => [part.id, ...part.sections.map((section) => section.id)]),
  );
}

describe('the Guide', () => {
  it('has a part for every project tab', () => {
    const anchors = guideAnchors();
    const tabAnchors = PROJECT_TABS.map(guidePartOf);

    expect(tabAnchors.filter((id) => !anchors.has(id))).toEqual([]);
  });

  it('has the part each other screen links to', () => {
    const anchors = guideAnchors();
    expect(SCREEN_ANCHORS.filter((id) => !anchors.has(id))).toEqual([]);
  });

  it('has the part each Review Queue help card links to', () => {
    const anchors = guideAnchors();
    const helpAnchors = Object.values(HELP).map((screen) => screen.guide);

    expect(helpAnchors.filter((id) => !anchors.has(id))).toEqual([]);
  });
});
