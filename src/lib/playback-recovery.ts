export type PlaybackRecoveryAction = 'none' | 'wait-network' | 'failover';

export const AUTOMATIC_FAILOVER_COUNTDOWN_SECONDS = 12;
export const SOURCE_STARTUP_TIMEOUT_MS = 25_000;

export function getPlaybackRecoveryAction(input: {
  online: boolean;
  stalledForMs: number;
  fatalRecoveryExhausted: boolean;
}): PlaybackRecoveryAction {
  if (!input.online) return 'wait-network';
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
