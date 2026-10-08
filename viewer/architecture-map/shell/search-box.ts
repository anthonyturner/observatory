import type { ArchitectureNode } from '../../../server/architecture/architecture-types.ts';
import { NODE_KIND_LOOK } from '../look.ts';
import type { MapIndex } from '../model/map-index.ts';
import { searchNodes, type Range, type SearchHit } from '../model/search.ts';
import { el } from './dom.ts';

const SUGGESTION_LIMIT = 8;

export interface SearchBox {
  readonly element: HTMLElement;
  focus(): void;
}

/** The name with the matched letters wrapped in `mark`, built as nodes so no name is read as markup. */
function highlighted(name: string, ranges: readonly Range[]): Node[] {
  const parts: Node[] = [];
  let from = 0;
  for (const [start, end] of ranges) {
    if (start > from) parts.push(document.createTextNode(name.slice(from, start)));
    parts.push(el('mark', { text: name.slice(start, end) }));
    from = end;
  }
  if (from < name.length) parts.push(document.createTextNode(name.slice(from)));
  return parts;
}

function optionFor(hit: SearchHit, id: string, where: string): HTMLElement {
  const { node } = hit;
  const look = NODE_KIND_LOOK[node.kind];
  return el(
    'li',
    { class: 'search__option', attrs: { id, role: 'option', 'aria-selected': 'false' } },
    el('span', { class: 'badge', text: look.badge, style: { '--kind': look.colour } }),
    el('span', {}, ...highlighted(node.name, hit.nameRanges)),
    el('span', { class: 'search__where', text: where }),
  );
}

/**
 * A search box that suggests nodes as you type, and picks one with the mouse or the keys:
 * arrows move, Enter picks, Escape closes the list and then clears the box.
 */
export function createSearchBox(
  index: MapIndex,
  nodes: readonly ArchitectureNode[],
  onPick: (nodeId: string) => void,
): SearchBox {
  const listId = 'search-suggestions';
  const input = el('input', {
    attrs: {
      type: 'search',
      placeholder: 'Find a class…  ( / )',
      role: 'combobox',
      'aria-label': 'Find a class',
      'aria-autocomplete': 'list',
      'aria-expanded': 'false',
      'aria-controls': listId,
      autocomplete: 'off',
      spellcheck: 'false',
    },
  });
  const list = el('ul', {
    class: 'search__list',
    attrs: { id: listId, role: 'listbox', 'aria-label': 'Suggestions' },
  });
  list.hidden = true;
  let hits: SearchHit[] = [];
  let active = -1;

  const rows = (): HTMLElement[] => [...list.querySelectorAll<HTMLElement>('[role="option"]')];

  const close = (): void => {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  };

  const highlight = (next: number): void => {
    active = next;
    rows().forEach((row, at) => row.setAttribute('aria-selected', String(at === active)));
    const row = rows()[active];
    if (row) {
      input.setAttribute('aria-activedescendant', row.id);
      row.scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  };

  const pick = (at: number): void => {
    const hit = hits[at];
    if (!hit) return;
    input.value = '';
    close();
    onPick(hit.node.id);
  };

  const whereOf = (node: ArchitectureNode): string =>
    index.areas.get(node.area)?.label ?? node.area;

  const refresh = (): void => {
    hits = searchNodes(nodes, input.value, SUGGESTION_LIMIT);
    list.replaceChildren(
      ...(input.value.trim() === ''
        ? []
        : hits.length > 0
          ? hits.map((hit, at) => {
              const row = optionFor(hit, `${listId}-${at}`, whereOf(hit.node));
              row.addEventListener('mousedown', (event) => {
                event.preventDefault();
                pick(at);
              });
              return row;
            })
          : [el('li', { class: 'search__none', text: 'Nothing matches.' })]),
    );
    const open = input.value.trim() !== '';
    list.hidden = !open;
    input.setAttribute('aria-expanded', String(open));
    highlight(hits.length > 0 ? 0 : -1);
  };

  input.addEventListener('input', refresh);
  input.addEventListener('blur', close);
  input.addEventListener('focus', () => {
    if (input.value.trim() !== '') refresh();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (hits.length === 0) return;
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      highlight((active + step + hits.length) % hits.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      pick(Math.max(active, 0));
    } else if (event.key === 'Escape' && (input.value !== '' || !list.hidden)) {
      event.stopPropagation();
      input.value = '';
      close();
    }
  });

  return { element: el('div', { class: 'search' }, input, list), focus: () => input.focus() };
}
