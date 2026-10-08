import { ICON_SHAPES, type IconName } from '../look.ts';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

type Child = Node | string | null | undefined | false;

type Listeners = {
  readonly [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void;
};

export interface ElementProps {
  readonly class?: string;
  readonly text?: string;
  /** Attributes; `undefined` and `false` leave the attribute off, `true` sets it empty. */
  readonly attrs?: Readonly<Record<string, string | number | boolean | undefined>>;
  readonly style?: Readonly<Record<string, string>>;
  readonly on?: Listeners;
}

function setAttributes(
  element: Element,
  attrs: Readonly<Record<string, string | number | boolean | undefined>>,
): void {
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    element.setAttribute(name, value === true ? '' : String(value));
  }
}

function append(element: Element, children: readonly Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    element.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
}

/** Builds an HTML element. Text goes in as text, never as markup, so a name from the map cannot inject any. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElementProps = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (props.class) element.className = props.class;
  if (props.text !== undefined) element.textContent = props.text;
  if (props.attrs) setAttributes(element, props.attrs);
  for (const [name, value] of Object.entries(props.style ?? {}))
    element.style.setProperty(name, value);
  for (const [type, listener] of Object.entries(props.on ?? {})) {
    // Object.entries loses which event a listener is for; Listeners pairs them, so they match.
    element.addEventListener(type, listener as EventListener);
  }
  append(element, children);
  return element;
}

export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Readonly<Record<string, string | number | boolean | undefined>> = {},
  ...children: Child[]
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NAMESPACE, tag);
  setAttributes(element, attrs);
  append(element, children);
  return element;
}

/** A runtime's line drawing, coloured by the text colour of where it is placed. */
export function icon(name: IconName): SVGSVGElement {
  return svg(
    'svg',
    {
      viewBox: '0 0 34 34',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 1.6,
      'aria-hidden': 'true',
    },
    ...ICON_SHAPES[name].map(({ tag, attrs }) => svg(tag, attrs)),
  );
}

export function clear(element: Element): void {
  element.replaceChildren();
}
