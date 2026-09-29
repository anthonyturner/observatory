import { TestBed } from '@angular/core/testing';
import { NewsVideo } from '../../../core/news/news.types';
import { NewsMedia } from './news-media';

const YOUTUBE: NewsVideo = {
  kind: 'embed',
  url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
};

function render(image: string | null, video: NewsVideo | null) {
  const fixture = TestBed.createComponent(NewsMedia);
  fixture.componentRef.setInput('title', 'Claude Code 3 ships');
  fixture.componentRef.setInput('image', image);
  fixture.componentRef.setInput('video', video);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('NewsMedia', () => {
  it('shows the picture full width, as decoration', () => {
    const img = render('https://news.example/cc3.png', null).element.querySelector('img');

    expect(img?.getAttribute('src')).toBe('https://news.example/cc3.png');
    expect(img?.alt).toBe('');
  });

  it('embeds a YouTube or Vimeo player in place of the picture, named for the story', () => {
    const { element } = render('https://news.example/cc3.png', YOUTUBE);
    const frame = element.querySelector('iframe');

    expect(frame?.getAttribute('src')).toBe(YOUTUBE.url);
    expect(frame?.title).toBe('Video: Claude Code 3 ships');
    expect(element.querySelector('img')).toBeNull();
  });

  it('embeds no other player, and shows the picture instead', () => {
    const { element } = render('https://news.example/cc3.png', {
      kind: 'embed',
      url: 'https://evil.example/embed/dQw4w9WgXcQ',
    });

    expect(element.querySelector('iframe')).toBeNull();
    expect(element.querySelector('img')).not.toBeNull();
  });

  it('plays a video file with controls, the picture as its poster, and nothing preloaded', () => {
    const video = render('https://news.example/cc3.png', {
      kind: 'file',
      url: 'https://cdn.example/clip.mp4',
    }).element.querySelector('video');

    expect(video?.getAttribute('src')).toBe('https://cdn.example/clip.mp4');
    expect(video?.getAttribute('poster')).toBe('https://news.example/cc3.png');
    expect(video?.hasAttribute('controls')).toBe(true);
    expect(video?.getAttribute('preload')).toBe('none');
    expect(video?.hasAttribute('autoplay')).toBe(false);
  });

  it('falls back from a video that will not play to the picture, and from that to nothing', () => {
    const { fixture, element } = render('https://news.example/cc3.png', {
      kind: 'file',
      url: 'https://cdn.example/clip.mp4',
    });

    element.querySelector('video')?.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(element.querySelector('video')).toBeNull();
    expect(element.querySelector('img')).not.toBeNull();

    element.querySelector('img')?.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(element.querySelector('img, video, iframe')).toBeNull();
  });

  it('shows nothing for a story with no media', () => {
    expect(render(null, null).element.querySelector('img, video, iframe')).toBeNull();
  });
});
