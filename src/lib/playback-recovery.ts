export type PlaybackRecoveryAction = 'none' | 'wait-network' | 'failover';

export const AUTOMATIC_FAILOVER_COUNTDOWN_SECONDS = 12;
export const SOURCE_STARTUP_TIMEOUT_MS = 25_000;
const HAVE_CURRENT_DATA = 2;

export type PlaybackAttemptResult =
  | 'playing'
  | 'await-user'
  | 'user-paused'
  | 'retry';

interface PlayableMedia {
  play: () => Promise<void> | void;
}

export async function attemptPlaybackAfterCanPlay(
  media: PlayableMedia,
  input: { userPaused: boolean }
): Promise<PlaybackAttemptResult> {
  if (input.userPaused) return 'user-paused';

  try {
    await media.play();
    return 'playing';
  } catch (error) {
    if (
      error instanceof DOMException &&
      (error.name === 'NotAllowedError' || error.name === 'SecurityError')
    ) {
      return 'await-user';
    }
    return 'retry';
  }
}

export function isPlaybackAwaitingUserAction(input: {
  paused: boolean;
  readyState: number;
}): boolean {
  return input.paused && input.readyState >= HAVE_CURRENT_DATA;
}

export function getPlaybackRecoveryAction(input: {
  online: boolean;
  stalledForMs: number;
  fatalRecoveryExhausted: boolean;
  paused?: boolean;
  readyState?: number;
}): PlaybackRecoveryAction {
  if (!input.online) return 'wait-network';
  if (
    typeof input.paused === 'boolean' &&
    typeof input.readyState === 'number' &&
    isPlaybackAwaitingUserAction({
      paused: input.paused,
      readyState: input.readyState,
    })
  ) {
    return 'none';
  }
  if (input.fatalRecoveryExhausted || input.stalledForMs >= 12_000) {
    return 'failover';
  }
  return 'none';
}

export function getFailoverTimerAction(
  online: boolean
): Extract<PlaybackRecoveryAction, 'wait-network' | 'failover'> {
  return online ? 'failover' : 'wait-network';
}

export function getSourceChangeRecoveryAction(input: {
  online: boolean;
  elapsedMs: number;
}): PlaybackRecoveryAction {
  return getSourceStartupRecoveryAction(input);
}

export function getSourceStartupRecoveryAction(input: {
  online: boolean;
  elapsedMs: number;
}): PlaybackRecoveryAction {
  if (!input.online) return 'wait-network';
  return input.elapsedMs >= SOURCE_STARTUP_TIMEOUT_MS ? 'failover' : 'none';
}
