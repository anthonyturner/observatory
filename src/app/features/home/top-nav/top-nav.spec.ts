import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TopNav } from './top-nav';

describe('TopNav', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('leads to the orrery inside the app', () => {
    const fixture = TestBed.createComponent(TopNav);
    fixture.detectChanges();

    const link = (fixture.nativeElement as HTMLElement).querySelector('a.link');
    expect(link?.getAttribute('href')).toBe('/orrery');
  });

  it('jumps to News and Projects, moving focus there without changing the address', () => {
    const fixture = TestBed.createComponent(TopNav);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const links = Array.from(element.querySelectorAll<HTMLAnchorElement>('.jumps a'));
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['#news', '#projects']);

    const news = document.createElement('section');
    news.id = 'news';
    news.tabIndex = -1;
    news.scrollIntoView = vi.fn();
    document.body.append(news);
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    links[0].dispatchEvent(click);

    expect(news.scrollIntoView).toHaveBeenCalled();
    expect(document.activeElement).toBe(news);
    expect(click.defaultPrevented).toBe(true);
    news.remove();
  });
});
