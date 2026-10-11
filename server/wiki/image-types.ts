import { posix } from 'node:path';

/** The images a Library page may draw, by file extension, and the type each is served as. */
const IMAGE_TYPES: Readonly<Record<string, string>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

/** The content type of an image file by its name, or null for any other file. */
export const imageTypeOf = (path: string): string | null =>
  IMAGE_TYPES[posix.extname(path).toLowerCase()] ?? null;
