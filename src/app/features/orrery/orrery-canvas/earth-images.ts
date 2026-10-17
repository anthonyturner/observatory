/** The Earth's NASA pictures, under `public/earth` (credits in `CREDITS.md` beside them). Only the Orrery loads them. */
export const EARTH_IMAGES = {
  day: 'earth/day.jpg',
  night: 'earth/night.jpg',
  clouds: 'earth/clouds.jpg',
} as const;

export function loadImage(document: Document, url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = document.createElement('img');
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`The picture ${url} did not load`));
    image.src = url;
  });
}
