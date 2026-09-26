import { TestBed } from '@angular/core/testing';
import { LastSeen } from './last-seen';

describe('LastSeen', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('remembers when each repository was last looked at', () => {
    const lastSeen = TestBed.inject(LastSeen);

    lastSeen.record('me/a', 1_700_000_000_000);

    expect(lastSeen.read('me/a')).toBe(1_700_000_000_000);
    expect(lastSeen.read('me/b')).toBeNull();
  });

  it('reads a damaged value as never, and carries on without storage', () => {
    const lastSeen = TestBed.inject(LastSeen);
    localStorage.setItem('observatory.lastSeen.me/a', 'soon');
    expect(lastSeen.read('me/a')).toBeNull();

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => lastSeen.record('me/a', 1)).not.toThrow();
    expect(lastSeen.read('me/a')).toBeNull();
  });
});
