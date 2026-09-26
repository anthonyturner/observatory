/** A link inside a notice, drawn in the page's accent. */
export interface NoticeLink {
  readonly href: string;
  readonly text: string;
}

export interface Notice {
  readonly status: number;
  readonly title: string;
  readonly text: string;
  readonly link?: NoticeLink;
  readonly setCookie?: string;
}

const ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (character) => ESCAPES[character]);

const PAGE_STYLE =
  'margin:0;display:grid;place-content:center;min-height:100vh;background:#04060e;' +
  'color:#c7d2ee;font:15px system-ui;text-align:center;padding:24px';
const TITLE_STYLE = 'font:italic 300 30px Georgia,serif;color:#eaf0ff';
const LINK_STYLE = 'color:#8ea2ff';

/** A small page of its own for sign-in's outcomes, in the site's night colours. */
export function noticePage(notice: Notice): Response {
  const link = notice.link
    ? ` <a style="${LINK_STYLE}" href="${escapeHtml(notice.link.href)}">${escapeHtml(notice.link.text)}</a>.`
    : '';
  const html =
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">` +
    `<title>${escapeHtml(notice.title)}</title><body style="${PAGE_STYLE}">` +
    `<h1 style="${TITLE_STYLE}">${escapeHtml(notice.title)}</h1>` +
    `<p>${escapeHtml(notice.text)}${link}</p></body>`;
  const headers = new Headers({
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
  });
  if (notice.setCookie) headers.append('set-cookie', notice.setCookie);
  return new Response(html, { status: notice.status, headers });
}
