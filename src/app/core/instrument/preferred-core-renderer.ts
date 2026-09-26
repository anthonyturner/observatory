import { ProjectSnapshot } from '../projects/project.types';
import { CoreFrame, CoreRenderer } from './core-renderer';
import { CoreView } from './core-view';

export interface RendererChoice {
  /** The better renderer, loaded on demand: it may be large, or fail to start. */
  readonly preferred: () => Promise<CoreRenderer>;
  /** Draws at once, and whenever the preferred one cannot. */
  readonly fallback: () => CoreRenderer;
  /** Told why the preferred renderer failed to load, or stopped drawing. */
  readonly onFallback: (reason: unknown) => void;
}

/** Draws with the fallback at once, switches to the preferred renderer once
 *  it has loaded and can draw, and goes back to the fallback for good if a
 *  preferred frame ever throws. Losing the better picture never loses the core. */
export class PreferredCoreRenderer implements CoreRenderer {
  private active: CoreRenderer | null = null;
  private host: HTMLElement | null = null;
  private redraw: () => void = () => undefined;
  private projects: readonly ProjectSnapshot[] = [];
  private view: CoreView | null = null;
  private isPreferredActive = false;
  private isDisposed = false;

  constructor(private readonly choice: RendererChoice) {}

  mount(host: HTMLElement, redraw: () => void): void {
    this.host = host;
    this.redraw = redraw;
    this.useFallback();
    this.upgrade().catch((reason: unknown) => this.choice.onFallback(reason));
  }

  canDraw(): boolean {
    return this.active?.canDraw() ?? false;
  }

  setProjects(projects: readonly ProjectSnapshot[]): void {
    this.projects = projects;
    this.active?.setProjects(projects);
  }

  setView(view: CoreView): void {
    this.view = view;
    this.active?.setView(view);
  }

  frame(frame: CoreFrame): void {
    try {
      this.active?.frame(frame);
    } catch (error: unknown) {
      if (!this.isPreferredActive) throw error;
      this.choice.onFallback(error);
      this.useFallback();
      this.active?.frame(frame);
    }
  }

  dispose(): void {
    this.isDisposed = true;
    this.active?.dispose();
    this.active = null;
  }

  private async upgrade(): Promise<void> {
    const preferred = await this.choice.preferred();
    if (this.isDisposed) return;
    this.usePreferred(preferred);
    this.redraw();
  }

  private useFallback(): void {
    if (!this.host) return;
    const fallback = this.choice.fallback();
    fallback.mount(this.host, this.redraw);
    this.adopt(fallback);
    this.isPreferredActive = false;
  }

  /** A preferred renderer that cannot draw here (no WebGL, say) is not a
   *  fault: it is dropped quietly and the fallback kept. */
  private usePreferred(preferred: CoreRenderer): void {
    if (!this.host) return;
    preferred.mount(this.host, this.redraw);
    if (!preferred.canDraw()) {
      preferred.dispose();
      return;
    }
    this.adopt(preferred);
    this.isPreferredActive = true;
  }

  /** Hands a mounted renderer what the core already knows, then retires the old one. */
  private adopt(next: CoreRenderer): void {
    next.setProjects(this.projects);
    if (this.view) next.setView(this.view);
    this.active?.dispose();
    this.active = next;
  }
}
