import { TestBed } from '@angular/core/testing';
import { NoAudioError } from './audio-tap';
import { BROWSER_PLATFORM, ComputerSoundSource } from './computer-sound-source';
import { MEDIA_DEVICES } from './media-devices';
import { TabSoundSource } from './tab-sound-source';

/** A share that came back with the video only, as when the audio box was left unticked. */
function silentShare() {
  const video = { stop: vi.fn() };
  const stream = {
    getVideoTracks: () => [video],
    getAudioTracks: () => [],
    getTracks: () => [video],
  };
  const getDisplayMedia = vi.fn(() => Promise.resolve(stream as unknown as MediaStream));
  return { media: { getDisplayMedia } as unknown as MediaDevices, getDisplayMedia, video };
}

function setup(media: MediaDevices | null, platform: string | null = 'Windows') {
  TestBed.configureTestingModule({
    providers: [
      { provide: MEDIA_DEVICES, useValue: media },
      { provide: BROWSER_PLATFORM, useValue: platform },
    ],
  });
  return { tab: TestBed.inject(TabSoundSource), computer: TestBed.inject(ComputerSoundSource) };
}

describe('the screen-sharing sound sources', () => {
  it('offer This tab wherever a screen can be shared, and Whole computer where Chrome shares system audio', () => {
    const { tab, computer } = setup(silentShare().media, 'Windows');
    expect(tab.options()).toEqual([{ id: 'tab', label: 'This tab' }]);
    expect(computer.options()).toEqual([{ id: 'computer', label: 'Whole computer' }]);
  });

  it('leave Whole computer out where the browser cannot capture system audio', () => {
    for (const platform of ['macOS', 'Linux', null]) {
      TestBed.resetTestingModule();
      const { tab, computer } = setup(silentShare().media, platform);
      expect(tab.options().length).toBe(1);
      expect(computer.options()).toEqual([]);
    }
  });

  it('offer nothing where no screen can be shared, as on a phone', () => {
    const { tab, computer } = setup(null, 'Android');
    expect(tab.options()).toEqual([]);
    expect(computer.options()).toEqual([]);
  });

  it('ask for this tab first, with its audio untouched', async () => {
    const share = silentShare();
    await expect(setup(share.media).tab.open()).rejects.toBeInstanceOf(NoAudioError);
    expect(share.getDisplayMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        preferCurrentTab: true,
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      }),
    );
  });

  it('ask for a whole screen with system audio, stopping the video at once', async () => {
    const share = silentShare();
    await expect(setup(share.media).computer.open()).rejects.toBeInstanceOf(NoAudioError);
    const [options] = share.getDisplayMedia.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(options).toEqual(
      expect.objectContaining({
        systemAudio: 'include',
        monitorTypeSurfaces: 'include',
        video: { displaySurface: 'monitor' },
      }),
    );
    expect(options['preferCurrentTab']).toBeUndefined();
    expect(share.video.stop).toHaveBeenCalled();
  });

  it('say how to share the right sound for each', () => {
    const { tab, computer } = setup(silentShare().media);
    expect(tab.guide.ask).toContain('Share tab audio');
    expect(computer.guide.ask).toContain('Also share system audio');
  });
});
