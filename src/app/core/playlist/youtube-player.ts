import type { VideoPlayer, VideoPlayerOptions } from './video-player';

/* The adapter for YouTube's IFrame Player API: the only file that knows its shape.
   https://developers.google.com/youtube/iframe_api_reference */

const API_SCRIPT = 'https://www.youtube.com/iframe_api';
/** The privacy-enhanced host: no cookies until the video plays. */
const PLAYER_HOST = 'https://www.youtube-nocookie.com';
const MAX_VOLUME = 100;

/** The player's state codes this adapter acts on. */
const STATE = { ended: 0, playing: 1, paused: 2 } as const;

interface YtPlayer {
  loadVideoById(videoId: string): void;
  playVideo(): void;
  pauseVideo(): void;
  setVolume(volume: number): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  destroy(): void;
}

interface YtPlayerOptions {
  readonly host: string;
  readonly width: string;
  readonly height: string;
  readonly videoId: string;
  readonly playerVars: Readonly<Record<string, number>>;
  readonly events: {
    readonly onReady: (event: { target: YtPlayer }) => void;
    readonly onStateChange: (event: { data: number }) => void;
    readonly onError: () => void;
  };
}

interface YtApi {
  readonly Player: new (element: HTMLElement, options: YtPlayerOptions) => YtPlayer;
}

interface YouTubeWindow {
  YT?: unknown;
  onYouTubeIframeAPIReady?: () => void;
}

let api: Promise<YtApi> | null = null;

/** A YouTube player drawn inside `options.host`, playing `options.videoId` once ready. */
export async function createYouTubePlayer(options: VideoPlayerOptions): Promise<VideoPlayer> {
  const { Player } = await loadApi(options.host.ownerDocument);
  // YouTube replaces the element it is given, so it gets one of its own, not the host.
  const mount = options.host.ownerDocument.createElement('div');
  options.host.replaceChildren(mount);
  return new Promise((resolve) => {
    const player = new Player(
      mount,
      playerOptions(options, () => resolve(adapt(player))),
    );
  });
}

function playerOptions(options: VideoPlayerOptions, ready: () => void): YtPlayerOptions {
  const { events } = options;
  return {
    host: PLAYER_HOST,
    width: '100%',
    height: '100%',
    videoId: options.videoId,
    playerVars: { autoplay: 1, controls: 0, playsinline: 1, rel: 0, iv_load_policy: 3 },
    events: {
      onReady: ({ target }) => {
        target.setVolume(Math.round(options.volume * MAX_VOLUME));
        ready();
      },
      onStateChange: ({ data }) => {
        if (data === STATE.playing) events.playing();
        else if (data === STATE.paused) events.paused();
        else if (data === STATE.ended) events.ended();
      },
      onError: () => events.failed(),
    },
  };
}

function adapt(player: YtPlayer): VideoPlayer {
  return {
    load: (videoId) => player.loadVideoById(videoId),
    play: () => player.playVideo(),
    pause: () => player.pauseVideo(),
    setVolume: (volume) => player.setVolume(Math.round(volume * MAX_VOLUME)),
    // Ahead of what has buffered too: a drag lands where it lets go.
    seekTo: (seconds) => player.seekTo(seconds, true),
    currentTime: () => finiteOrZero(player.getCurrentTime()),
    duration: () => finiteOrZero(player.getDuration()),
    dispose: () => player.destroy(),
  };
}

/** The API, loaded once per page however many players ask for it. */
function loadApi(document: Document): Promise<YtApi> {
  api ??= new Promise<YtApi>((resolve, reject) => {
    const window = document.defaultView as (Window & YouTubeWindow) | null;
    if (!window) return reject(new Error('No window to load the YouTube player into'));
    if (isYtApi(window.YT)) return resolve(window.YT);
    const earlier = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      earlier?.();
      if (isYtApi(window.YT)) resolve(window.YT);
      else reject(new Error('The YouTube player API loaded without a Player'));
    };
    const script = document.createElement('script');
    script.src = API_SCRIPT;
    script.onerror = () => {
      api = null;
      reject(new Error('The YouTube player API would not load'));
    };
    document.head.append(script);
  });
  return api;
}

/** The player answers undefined or NaN before a video has loaded. */
function finiteOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function isYtApi(value: unknown): value is YtApi {
  return typeof value === 'object' && value !== null && 'Player' in value
    ? typeof value.Player === 'function'
    : false;
}
