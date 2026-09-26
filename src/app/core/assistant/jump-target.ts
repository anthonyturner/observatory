/** Where an action's `href` leads from the page at `here`: nowhere new, a page
 *  of this app (its path, query and fragment, for the router), or another site. */
export type JumpTarget =
  | { readonly kind: 'here' }
  | { readonly kind: 'page'; readonly url: string }
  | { readonly kind: 'away'; readonly href: string };

export function jumpTargetOf(href: string, here: string): JumpTarget {
  const target = new URL(href, here);
  const current = new URL(here);
  if (target.origin !== current.origin) return { kind: 'away', href: target.href };
  if (target.pathname === current.pathname && !target.hash) return { kind: 'here' };
  return { kind: 'page', url: `${target.pathname}${target.search}${target.hash}` };
}
