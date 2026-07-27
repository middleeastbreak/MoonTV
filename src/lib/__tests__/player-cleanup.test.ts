import { destroyPlayerMedia, PlayerWithMedia } from '../player-cleanup';

describe('destroyPlayerMedia', () => {
  it('stops audible media before destroying the player', () => {
    const video = document.createElement('video');
    let playing = true;

    Object.defineProperty(video, 'paused', {
      configurable: true,
      get: () => !playing,
    });
    video.pause = jest.fn(() => {
      playing = false;
    });
    video.load = jest.fn();
    video.src = 'https://example.com/video.m3u8';

    const player: PlayerWithMedia = {
      video,
      destroy: jest.fn(),
    };

    destroyPlayerMedia(player);

    expect(video.pause).toHaveBeenCalledTimes(1);
    expect(video.paused).toBe(true);
    expect(video.hasAttribute('src')).toBe(false);
    expect(video.load).toHaveBeenCalledTimes(1);
    expect(player.destroy).toHaveBeenCalledTimes(1);
  });

  it('still stops media and destroys the player when HLS cleanup fails', () => {
    const video = document.createElement('video') as HTMLVideoElement & {
      hls?: { destroy(): void };
    };
    video.pause = jest.fn();
    video.load = jest.fn();
    video.hls = {
      destroy: jest.fn(() => {
        throw new Error('HLS cleanup failed');
      }),
    };

    const player: PlayerWithMedia = {
      video,
      destroy: jest.fn(),
    };

    expect(() => destroyPlayerMedia(player)).not.toThrow();
    expect(video.pause).toHaveBeenCalledTimes(1);
    expect(player.destroy).toHaveBeenCalledTimes(1);
  });
});
