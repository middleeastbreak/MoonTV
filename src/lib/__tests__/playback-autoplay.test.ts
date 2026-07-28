import {
  attemptPlaybackAfterCanPlay,
  isPlaybackAwaitingUserAction,
} from '@/lib/playback-recovery';

describe('switched-source autoplay handling', () => {
  it('retries playback when the first source becomes playable', async () => {
    const play = jest.fn().mockResolvedValue(undefined);

    await expect(
      attemptPlaybackAfterCanPlay({ play }, { userPaused: false })
    ).resolves.toBe('playing');
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('asks for a tap only after the browser rejects playback', async () => {
    const play = jest
      .fn()
      .mockRejectedValue(new DOMException('Not allowed', 'NotAllowedError'));

    await expect(
      attemptPlaybackAfterCanPlay({ play }, { userPaused: false })
    ).resolves.toBe('await-user');
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('keeps source recovery active for non-permission playback failures', async () => {
    const play = jest.fn().mockRejectedValue(new Error('Media decode failed'));

    await expect(
      attemptPlaybackAfterCanPlay({ play }, { userPaused: false })
    ).resolves.toBe('retry');
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('does not resume after the user deliberately pauses', async () => {
    const play = jest.fn().mockResolvedValue(undefined);

    await expect(
      attemptPlaybackAfterCanPlay({ play }, { userPaused: true })
    ).resolves.toBe('user-paused');
    expect(play).not.toHaveBeenCalled();
  });

  it('does not fail over again when iPad has loaded playable data but blocks autoplay', () => {
    expect(
      isPlaybackAwaitingUserAction({
        paused: true,
        readyState: 3,
      })
    ).toBe(true);
  });

  it('still allows failover when the replacement source has no playable data', () => {
    expect(
      isPlaybackAwaitingUserAction({
        paused: true,
        readyState: 0,
      })
    ).toBe(false);
  });

  it('does not mistake active buffering for a user-action pause', () => {
    expect(
      isPlaybackAwaitingUserAction({
        paused: false,
        readyState: 3,
      })
    ).toBe(false);
  });
});
