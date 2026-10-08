import { MAP_ELEMENT_ID, readMap } from './map-source.ts';
import './shell/shell.css';
import { el } from './shell/dom.ts';
import { startShell } from './shell/shell.ts';
import { VIEWS } from './views/registry.ts';

const root = document.body;
try {
  const map = readMap(document.getElementById(MAP_ELEMENT_ID)?.textContent);
  startShell({ map, views: VIEWS, root });
} catch (error) {
  root.replaceChildren(
    el('p', { class: 'error', text: error instanceof Error ? error.message : String(error) }),
  );
}
