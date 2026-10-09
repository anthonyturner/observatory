import { guideMatching, guideOf, sectionCount } from './guide';

const MARKDOWN = `# Observatory guide

Welcome to the sky.

## Orrery

One world per project.

### Worlds

Air colour is the most urgent state.

### Night side

City lights are work in motion.

## Review Queue

### Stars

Each star is one open pull request.

#### Kind

A deep giant is blocked.
`;

describe('guideOf', () => {
  const guide = guideOf(MARKDOWN);

  it('keeps the text before the first part as its intro, without the title', () => {
    expect(guide.intro).toEqual([
      {
        kind: 'p',
        spans: [{ kind: 'text', text: 'Welcome to the sky.', strong: false, em: false }],
      },
    ]);
  });

  it('makes each second-level heading a part and each third-level one a section in it', () => {
    expect(
      guide.parts.map((part) => [part.id, part.sections.map((section) => section.id)]),
    ).toEqual([
      ['orrery', ['worlds', 'night-side']],
      ['review-queue', ['stars']],
    ]);
  });

  it('starts a part with its heading and the words under it, and a section with its heading', () => {
    const [orrery, queue] = guide.parts;
    expect(orrery.lead.map((block) => block.kind)).toEqual(['heading', 'p']);
    expect(orrery.sections[0].blocks.map((block) => block.kind)).toEqual(['heading', 'p']);
    expect(queue.sections[0].blocks.map((block) => block.kind)).toEqual([
      'heading',
      'p',
      'heading',
      'p',
    ]);
  });

  it('reads each section as plain words, deeper headings included', () => {
    expect(guide.parts[1].sections[0].text).toBe(
      'Stars Each star is one open pull request. Kind A deep giant is blocked.',
    );
    expect(guide.parts[1].sections[0].wordCount).toBe(14);
  });
});

describe('guideMatching', () => {
  const guide = guideOf(MARKDOWN);

  it('leaves the guide whole with no search', () => {
    expect(guideMatching(guide, [])).toBe(guide);
  });

  it('keeps only the sections holding every word, and the parts they are in', () => {
    const found = guideMatching(guide, ['city', 'lights']);

    expect(found.parts.map((part) => part.sections.map((section) => section.id))).toEqual([
      ['night-side'],
    ]);
    expect(found.intro).toEqual([]);
  });

  it('matches a section by the name of its part', () => {
    const found = guideMatching(guide, ['orrery', 'air']);

    expect(found.parts.map((part) => part.sections.map((section) => section.id))).toEqual([
      ['worlds'],
    ]);
  });

  it('keeps a whole part whose own heading and words match', () => {
    const found = guideMatching(guide, ['one', 'world']);

    expect(found.parts.map((part) => part.id)).toEqual(['orrery']);
    expect(found.parts[0].sections.length).toBe(2);
  });

  it('finds nothing when no section holds every word', () => {
    expect(guideMatching(guide, ['comet']).parts).toEqual([]);
  });
});

describe('sectionCount', () => {
  it('counts the sections across every part', () => {
    expect(sectionCount(guideOf(MARKDOWN))).toBe(3);
  });
});
