import { decodeEntities } from '../reader/readable.ts';

// A story's thumbnail: https only, so the hosted site never mixes in plain http.

/** An image this small is a tracking pixel or a spacer, not a picture of the story. */
const MAX_PIXEL_SIDE = 2;

/** `value` as an https address, resolved against `base` where it is relative; null otherwise. */
export function httpsImage(value: string | null | undefined, base?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(decodeEntities(value.trim()), base);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

const attr = (tag: string, name: string): string | undefined =>
  new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag)?.[1];

const tags = (xml: string, name: string): string[] =>
  xml.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) ?? [];

const isPixel = (tag: string): boolean =>
  ['width', 'height'].some((side) => {
    const size = Number(attr(tag, side));
    return size > 0 && size <= MAX_PIXEL_SIDE;
  });

/** The first `<img>` in a description or content, escaped or not, that is not a pixel. */
function firstPicture(entry: string): string | null {
  const markup = decodeEntities(entry.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'));
  for (const img of tags(markup, 'img')) {
    const src = isPixel(img) ? null : httpsImage(attr(img, 'src'));
    if (src) return src;
  }
  return null;
}

const isImageType = (tag: string): boolean => /^image\//i.test(attr(tag, 'type') ?? '');

/** The image a feed entry names: a media thumbnail or image, an image enclosure,
 *  an iTunes cover, or else the first picture in its description or content. */
export function feedImage(entry: string): string | null {
  const named = [
    ...tags(entry, 'media:thumbnail').map((tag) => attr(tag, 'url')),
    ...tags(entry, 'media:content')
      .filter((tag) => attr(tag, 'medium') === 'image' || isImageType(tag))
      .map((tag) => attr(tag, 'url')),
    ...tags(entry, 'enclosure')
      .filter(isImageType)
      .map((tag) => attr(tag, 'url')),
    ...tags(entry, 'itunes:image').map((tag) => attr(tag, 'href')),
  ];
  for (const url of named) {
    const image = httpsImage(url);
    if (image) return image;
  }
  return firstPicture(entry);
}

/** The picture a web page offers for sharing: Open Graph's, then Twitter's card. */
export function pageImage(html: string, pageUrl: string): string | null {
  const metas = tags(html, 'meta');
  for (const key of ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']) {
    const meta = metas.find((tag) => (attr(tag, 'property') ?? attr(tag, 'name')) === key);
    const image = meta ? httpsImage(attr(meta, 'content'), pageUrl) : null;
    if (image) return image;
  }
  return null;
}
