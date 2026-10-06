import { detailOf, optionIdOf, sourceIdOf } from './option-id';

describe('option ids', () => {
  it('join a source and a detail, and split them again', () => {
    const id = optionIdOf('input', 'a:b');
    expect(id).toBe('input:a:b');
    expect(sourceIdOf(id)).toBe('input');
    expect(detailOf(id)).toBe('a:b');
  });

  it('read a source’s own entry as having no detail', () => {
    expect(sourceIdOf('tab')).toBe('tab');
    expect(detailOf('tab')).toBeNull();
  });
});
