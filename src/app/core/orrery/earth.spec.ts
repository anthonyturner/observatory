import { EARTH_TURN, MapPixels, earthDisc } from './earth';

/** A 360 by 180 map, one pixel a degree, whose red is the column and whose green is the row. */
function coordinateMap(): MapPixels {
  const width = 360;
  const height = 180;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      const at = (row * width + column) * 4;
      data[at] = column % 256;
      data[at + 1] = row;
      data[at + 3] = 255;
    }
  }
  return { width, height, data };
}

describe('earthDisc', () => {
  const size = 64;
  const disc = earthDisc(coordinateMap(), size);
  const pixel = (column: number, row: number): number[] => {
    const at = (row * size + column) * 4;
    return Array.from(disc.slice(at, at + 4));
  };

  it('faces the Atlantic at its centre, north up', () => {
    const [red, green] = pixel(size / 2, size / 2);

    // Longitude -30 is column 150 of a map that starts at -180; the equator is row 90.
    expect(red).toBeCloseTo(150, -1);
    expect(green).toBeCloseTo(90, -1);
  });

  it('shows land to the north higher on the map, and to the east further right', () => {
    const [centreRed, centreGreen] = pixel(size / 2, size / 2);

    expect(pixel(size / 2, 8)[1]).toBeLessThan(centreGreen);
    expect(pixel(size - 8, size / 2)[0]).toBeGreaterThan(centreRed);
  });

  it('leaves everything outside the globe transparent and softens its edge', () => {
    expect(pixel(0, 0)[3]).toBe(0);
    expect(pixel(size / 2, size / 2)[3]).toBe(255);
    expect(pixel(size / 2, 0)[3]).toBeLessThan(255);
  });

  it('turns the 3D ground a quarter turn plus the facing longitude', () => {
    expect(EARTH_TURN).toBeCloseTo(-Math.PI / 3);
  });
});
