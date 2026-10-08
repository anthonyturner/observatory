/** One software-design idea, as a card or Jev gives it. */
export interface Principle {
  /** Stable across edits of the words, so later features can remember one. */
  readonly id: string;
  readonly title: string;
  /** What it means, in a sentence or two of plain English. */
  readonly idea: string;
  /** Something to ask yourself today. */
  readonly question: string;
}

/**
 * John Ousterhout's ideas from A Philosophy of Software Design and his
 * interview in docs/software-design-transcript.txt. The order is the order the
 * days walk through them, so a new one goes at the end rather than shifting
 * every later day.
 */
export const PRINCIPLES: readonly Principle[] = [
  {
    id: 'strategic-not-tactical',
    title: 'Program strategically, not tactically',
    idea: 'Working code is the minimum, not the goal. Aim for a design that keeps the next change cheap, and spend roughly 10 to 20 percent more time to get it.',
    question: 'Where did you take a shortcut today that the next change will pay for?',
  },
  {
    id: 'tactical-tornado',
    title: 'Beware the tactical tornado',
    idea: 'A tactical tornado ships features faster than anyone, but leaves a trail of mess that others have to clean up. Speed that adds complexity is not productivity.',
    question: 'Did anything you shipped quickly today leave work for someone else?',
  },
  {
    id: 'deep-modules',
    title: 'Make modules deep',
    idea: 'The best modules hide a lot of work behind a simple interface. The interface is what a module costs its callers; what it hides is what it gives them.',
    question: 'Which interface you touched today could be simpler while hiding more?',
  },
  {
    id: 'shallow-modules',
    title: 'Avoid shallow modules',
    idea: 'A class or method whose interface is nearly as complex as what it does adds cost and hides nothing. Many tiny ones make a system harder to learn, not easier.',
    question: 'Did you add a wrapper or a pass-through today that hides nothing?',
  },
  {
    id: 'errors-out-of-existence',
    title: 'Define errors out of existence',
    idea: 'Error handling is where special cases pile up. Where you can, choose a meaning in which the error cannot happen: deleting something already gone simply succeeds.',
    question: 'Which error you handled today could the design have made impossible?',
  },
  {
    id: 'defining-is-not-ignoring',
    title: 'Defining an error away is not ignoring it',
    idea: 'Defining an error out of existence changes what the operation means so the case is no longer an error. Skipping the check for a failure that can really happen is just ignoring it.',
    question: 'Is there a failure in your code that you are quietly hoping never happens?',
  },
  {
    id: 'design-it-twice',
    title: 'Design it twice',
    idea: 'Your first idea is rarely your best. Sketch at least one quite different approach, compare the two, and pick or blend the better parts.',
    question: 'What was your second idea today?',
  },
  {
    id: 'callers-side',
    title: "Think from the caller's side",
    idea: 'While you build a module you know all its details; its users want to know as few of them as possible. Switch seats and design for the person calling it.',
    question: 'What would a caller of your code have to learn that they should not need to?',
  },
  {
    id: 'general-purpose',
    title: 'General-purpose beats special cases',
    idea: 'Push the design towards general mechanisms that solve many problems. Every special case is one more thing someone has to remember.',
    question: 'Which special case today could a slightly more general design absorb?',
  },
  {
    id: 'decomposition',
    title: 'Design is decomposition',
    idea: 'Software design is dividing a large, complicated system into smaller units that can be built and understood fairly independently.',
    question: 'Could each unit you worked on today be understood on its own?',
  },
  {
    id: 'design-permeates',
    title: 'Design never stops',
    idea: 'Do some design up front, then keep designing while you code, test and fix bugs. Design runs through the whole of development, not one phase of it.',
    question: 'What did today’s coding teach you about the design?',
  },
  {
    id: 'abstractions-not-tests',
    title: 'Develop in abstractions, not tests',
    idea: 'Make each chunk of work a whole abstraction rather than one test at a time. Writing just enough code to pass each test pulls a design towards narrow, special-purpose code.',
    question: 'Was today’s chunk of work a whole abstraction, or a string of patches?',
  },
  {
    id: 'test-first-for-bugs',
    title: 'Write the test first when fixing a bug',
    idea: 'The one place a test should come first is a bug fix: write a test that catches the bug, watch it fail, then fix the code.',
    question: 'Does your last bug fix have a test that failed before the fix?',
  },
  {
    id: 'comments-say-what-code-cannot',
    title: "Comments say what code can't",
    idea: 'A comment earns its place by saying what the code cannot: the abstraction, the reason, the outside constraint. Write the interface comments first, as part of the design.',
    question: 'What does a reader of today’s code need that the code cannot tell them?',
  },
  {
    id: 'together-what-belongs',
    title: 'Keep together what belongs together',
    idea: 'When two pieces share knowledge or are always used together, joining them often gives one simpler, deeper module than keeping them apart.',
    question: 'Did you split something today that would be easier to understand whole?',
  },
  {
    id: 'for-against-straw-poll',
    title: 'Argue for and against, then take a straw poll',
    idea: 'At the whiteboard, list the arguments for and against each option until nobody has more to add, then take a quick vote. The room usually agrees more than the arguing suggested.',
    question: 'Which open decision would a for-and-against list settle quickly?',
  },
  {
    id: 'learn-from-mistakes',
    title: 'Mistakes, feedback, redo',
    idea: 'Most learning comes from making mistakes, seeing why they are mistakes, and fixing them. Get feedback early, admit the first idea was not great, and redo it.',
    question: 'What did you get wrong recently, and what did it teach you?',
  },
  {
    id: 'everything-is-trade-offs',
    title: 'Everything is a trade-off',
    idea: 'Every design idea has limits. Push any one too far, even deep modules or designing twice, and you end up somewhere bad.',
    question: 'Which good idea are you pushing too far right now?',
  },
];
