import { SearchResult } from './types';

export const SOURCE_HEALTH_STORAGE_KEY = 'moontv_source_health_v1';

export interface SourceHealthRecord {
  successes: number;
  failures: number;
  consecutiveFailures: number;
  averageStartupMs: number;
  lastSuccessAt: number;
  lastFailureAt: number;
}

type SourceHealthMap = Record<string, SourceHealthRecord>;

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function sourceHealthKey(source: Pick<SearchResult, 'source'>): string {
  return source.source;
}

export function readSourceHealth(storage: StorageLike): SourceHealthMap {
  try {
    const value = JSON.parse(
      storage.getItem(SOURCE_HEALTH_STORAGE_KEY) || '{}'
    );
    return value && typeof value === 'object' ? value : {};
  } catch (_) {
    return {};
  }
}

function writeSourceHealth(storage: StorageLike, health: SourceHealthMap) {
  try {
    storage.setItem(SOURCE_HEALTH_STORAGE_KEY, JSON.stringify(health));
  } catch (_) {
    // Playback must continue when storage is unavailable or full.
  }
}

export function recordSourceSuccess(
  storage: StorageLike,
  source: string,
  startupMs: number,
  now = Date.now()
) {
  const health = readSourceHealth(storage);
  const previous = health[source];
  const successes = (previous?.successes || 0) + 1;
  health[source] = {
    successes,
    failures: previous?.failures || 0,
    consecutiveFailures: 0,
    averageStartupMs: previous?.averageStartupMs
      ? Math.round(
          (previous.averageStartupMs * (successes - 1) + startupMs) / successes
        )
      : Math.round(startupMs),
    lastSuccessAt: now,
    lastFailureAt: previous?.lastFailureAt || 0,
  };
  writeSourceHealth(storage, health);
}

export function recordSourceFailure(
  storage: StorageLike,
  source: string,
  now = Date.now()
) {
  const health = readSourceHealth(storage);
  const previous = health[source];
  health[source] = {
    successes: previous?.successes || 0,
    failures: (previous?.failures || 0) + 1,
    consecutiveFailures: (previous?.consecutiveFailures || 0) + 1,
    averageStartupMs: previous?.averageStartupMs || 0,
    lastSuccessAt: previous?.lastSuccessAt || 0,
    lastFailureAt: now,
  };
  writeSourceHealth(storage, health);
}

function healthScore(record: SourceHealthRecord | undefined, now: number) {
  if (!record) return 0;
  const recentFailure = now - record.lastFailureAt < 24 * 60 * 60 * 1000;
  const reliability = record.successes - record.failures * 1.5;
  const startupPenalty = Math.min(3, record.averageStartupMs / 5000);
  return (
    reliability -
    startupPenalty -
    record.consecutiveFailures * 4 -
    (recentFailure ? 2 : 0)
  );
}

export function selectFailoverSource(
  sources: SearchResult[],
  currentSource: string,
  currentId: string,
  episodeIndex: number,
  attemptedKeys: Set<string>,
  health: SourceHealthMap,
  now = Date.now()
): SearchResult | null {
  const candidates = sources
    .map((source, index) => ({ source, index }))
    .filter(({ source }) => {
      const key = `${source.source}:${source.id}`;
      return (
        !(source.source === currentSource && source.id === currentId) &&
        !attemptedKeys.has(key) &&
        Boolean(source.episodes?.[episodeIndex])
      );
    });

  candidates.sort((a, b) => {
    const scoreDifference =
      healthScore(health[sourceHealthKey(b.source)], now) -
      healthScore(health[sourceHealthKey(a.source)], now);
    return scoreDifference || a.index - b.index;
  });
  return candidates[0]?.source || null;
}

export function formatPlaybackDiagnostics(value: {
  source: string;
  quality: string;
  bufferSeconds: number;
  recoveryAttempts: number;
  lastError: string;
  failoverCount: number;
}): string {
  return [
    `播放源: ${value.source || '未知'}`,
    `画质: ${value.quality || '自动'}`,
    `缓冲: ${Math.max(0, value.bufferSeconds).toFixed(1)} 秒`,
    `恢复尝试: ${value.recoveryAttempts}`,
    `自动换源: ${value.failoverCount}`,
    `最近错误: ${value.lastError || '无'}`,
  ].join('\n');
}
