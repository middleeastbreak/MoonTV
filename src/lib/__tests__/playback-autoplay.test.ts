import { isPlaybackAwaitingUserAction } from '@/lib/playback-recovery';

describe('switched-source autoplay handling', () => {
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
