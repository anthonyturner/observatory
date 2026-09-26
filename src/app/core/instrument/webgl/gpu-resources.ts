/** Anything three.js allocates on the graphics card and must be told to free. */
export interface Disposable {
  dispose(): void;
}

/** Collects what a scene allocates, so a rebuild or a teardown frees all of it. */
export class GpuResources {
  private readonly owned = new Set<Disposable>();

  own<T extends Disposable>(resource: T): T {
    this.owned.add(resource);
    return resource;
  }

  disposeAll(): void {
    this.owned.forEach((resource) => resource.dispose());
    this.owned.clear();
  }
}
