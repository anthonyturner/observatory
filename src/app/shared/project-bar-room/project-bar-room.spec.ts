import { TestBed } from '@angular/core/testing';
import { ProjectBarSize } from '../../core/project-bar/project-bar-size';
import { ProjectBarRoom } from './project-bar-room';

describe('ProjectBarRoom', () => {
  it('is as big as the project bar, and nothing while there is none', () => {
    const fixture = TestBed.createComponent(ProjectBarRoom);
    const element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    expect(element.style.height).toBe('0px');

    TestBed.inject(ProjectBarSize).take({ width: 480, height: 28 });
    fixture.detectChanges();

    expect([element.style.width, element.style.height]).toEqual(['480px', '28px']);
  });
});
