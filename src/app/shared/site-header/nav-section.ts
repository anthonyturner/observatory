/** A count on a section, such as Security's open alerts. */
export interface NavBadge {
  readonly shown: string;
  /** Read after the section's name: "3 open alerts". */
  readonly spoken: string;
}

/** One place the header can take you: a link, with the state a screen reader and the eye should hear. */
export interface NavSection {
  readonly id: string;
  readonly label: string;
  readonly link: string;
  /** The anchor within the page `link` leads to. */
  readonly fragment?: string;
  /** The page the viewer is on. */
  readonly isCurrent?: boolean;
  readonly badge?: NavBadge;
  /** There is nothing here yet, so the link recedes. */
  readonly isQuiet?: boolean;
}
