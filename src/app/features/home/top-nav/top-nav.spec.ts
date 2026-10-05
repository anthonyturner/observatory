import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MAIL_SHOWN } from '../../../core/mail/mail-inbox';
import { TopNav } from './top-nav';

describe('TopNav', () => {
  const hasMail = signal(false);

  beforeEach(() => {
    hasMail.set(false);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: MAIL_SHOWN, useValue: hasMail }],
    });
  });

  const jumpLinks = (element: HTMLElement) =>
    Array.from(element.querySelectorAll<HTMLAnchorElement>('.jumps a'));

  it('leads to the orrery inside the app', () => {
    const fixture = TestBed.createComponent(TopNav);
    fixture.detectChanges();

    const link = (fixture.nativeElement as HTMLElement).querySelector('a.link');
    expect(link?.getAttribute('href')).toBe('/orrery');
  });

  it('jumps to Projects and Agents, moving focus there without changing the address', () => {
    const fixture = TestBed.createComponent(TopNav);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const links = jumpLinks(element);
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['#projects', '#agents']);

    const projects = document.createElement('section');
    projects.id = 'projects';
    projects.tabIndex = -1;
    projects.scrollIntoView = vi.fn();
    document.body.append(projects);
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    links[0].dispatchEvent(click);

    expect(projects.scrollIntoView).toHaveBeenCalled();
    expect(document.activeElement).toBe(projects);
    expect(click.defaultPrevented).toBe(true);
    projects.remove();
  });

  it('jumps to Mail first, where Home has it', () => {
    const fixture = TestBed.createComponent(TopNav);
    hasMail.set(true);
    fixture.detectChanges();

    expect(jumpLinks(fixture.nativeElement).map((link) => link.getAttribute('href'))).toEqual([
      '#mail',
      '#projects',
      '#agents',
    ]);
  });
});
