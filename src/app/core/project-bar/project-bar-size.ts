import { Injectable, signal } from '@angular/core';
import { ElementSize } from '../../shared/element-size/element-size';

const NO_ROOM: ElementSize = { width: 0, height: 0 };

/**
 * How much room the project bar takes at the top of a project's screens. The
 * bar floats over the page, so each page leaves that much room in its header
 * (`app-project-bar-room`) and lays out around it. Nothing is reserved while
 * no project shell is on screen.
 */
@Injectable({ providedIn: 'root' })
export class ProjectBarSize {
  private readonly current = signal<ElementSize>(NO_ROOM);

  readonly room = this.current.asReadonly();

  take(size: ElementSize): void {
    this.current.set(size);
  }

  release(): void {
    this.current.set(NO_ROOM);
  }
}
