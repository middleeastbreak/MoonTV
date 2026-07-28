import {
  AUTOMATIC_FAILOVER_COUNTDOWN_SECONDS,
  getFailoverTimerAction,
  getPlaybackRecoveryAction,
  getSourceChangeRecoveryAction,
  getSourceStartupRecoveryAction,
} from '@/lib/playback-recovery';

describe('playback recovery decisions', () => {
  it('waits for the network instead of wasting fallback sources while offline', () => {
    expect(
      getPlaybackRecoveryAction({
        online: false,
        stalledForMs: 20_000,
        fatalRecoveryExhausted: true,
      })
    ).toBe('wait-network');
  });

  it('fails over when playback stays stalled after connectivity is available', () => {
    expect(
      getPlaybackRecoveryAction({
        online: true,
        stalledForMs: 15_000,
        fatalRecoveryExhausted: false,
      })
    ).toBe('failover');
  });

  it('waits for a user gesture instead of rejecting a playable paused source', () => {
    expect(
      getPlaybackRecoveryAction({
        online: true,
        stalledForMs: 15_000,
        fatalRecoveryExhausted: false,
        paused: true,
        readyState: 3,
      })
    ).toBe('none');

    expect(
      getPlaybackRecoveryAction({
        online: true,
        stalledForMs: 15_000,
        fatalRecoveryExhausted: false,
        paused: true,
        readyState: 0,
      })
    ).toBe('failover');
  });

  it('fails over immediately after online HLS recovery is exhausted', () => {
    expect(
      getPlaybackRecoveryAction({
        online: true,
        stalledForMs: 0,
        fatalRecoveryExhausted: true,
      })
    ).toBe('failover');
  });

  it('gives the user a longer cancel window before switching sources', () => {
    expect(AUTOMATIC_FAILOVER_COUNTDOWN_SECONDS).toBeGreaterThanOrEqual(10);
  });

  it('does not enter source switching when the countdown expires offline', () => {
    expect(getFailoverTimerAction(false)).toBe('wait-network');
  });

  it('escapes a source-changing overlay when the new source never becomes playable', () => {
    expect(
      getSourceChangeRecoveryAction({ online: true, elapsedMs: 30_000 })
    ).toBe('failover');
    expect(
      getSourceChangeRecoveryAction({ online: false, elapsedMs: 30_000 })
    ).toBe('wait-network');
  });

  it('fails over when the initial source never emits an error or becomes playable', () => {
    expect(
      getSourceStartupRecoveryAction({ online: true, elapsedMs: 30_000 })
    ).toBe('failover');
    expect(
      getSourceStartupRecoveryAction({ online: false, elapsedMs: 30_000 })
    ).toBe('wait-network');
  });
});
