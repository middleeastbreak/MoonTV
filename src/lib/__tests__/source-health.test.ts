import {
  rankSourcesByPlaybackHealth,
  readSourceHealth,
  recordSourceFailure,
  recordSourceSuccess,
  selectFailoverSource,
} from '@/lib/source-health';
import { SearchResult } from '@/lib/types';

const source = (name: string, episodes = ['url']): SearchResult => ({
  id: name,
  title: '作品',
  poster: '',
  episodes,
  episodes_titles: [],
  source: name,
  source_name: name,
  year: '2026',
  type_name: '剧集',
});

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe('playback source health', () => {
  it('prefers a healthy untried source that contains the current episode', () => {
    const storage = memoryStorage();
    recordSourceFailure(storage, 'bad', 1000);
    recordSourceSuccess(storage, 'healthy', 800, 1000);
    const selected = selectFailoverSource(
      [
        source('current'),
        source('missing', []),
        source('bad'),
        source('healthy'),
      ],
      'current',
      'current',
      0,
      new Set(),
      readSourceHealth(storage),
      2000
    );
    expect(selected?.source).toBe('healthy');
  });

  it('never retries a source that was already attempted', () => {
    const selected = selectFailoverSource(
      [source('current'), source('first'), source('second')],
      'current',
      'current',
      0,
      new Set(['first:first']),
      {},
      2000
    );
    expect(selected?.source).toBe('second');
  });

  it('uses real playback history before a one-shot probe score', () => {
    const storage = memoryStorage();
    recordSourceSuccess(storage, 'proven', 1200, 1000);
    recordSourceFailure(storage, 'failed', 1500);

    const ranked = rankSourcesByPlaybackHealth(
      [
        { source: source('failed'), probeScore: 100, originalIndex: 0 },
        { source: source('unknown'), probeScore: 80, originalIndex: 1 },
        { source: source('proven'), probeScore: 20, originalIndex: 2 },
      ],
      readSourceHealth(storage),
      2000
    );

    expect(ranked.map((item) => item.source.source)).toEqual([
      'proven',
      'unknown',
      'failed',
    ]);
  });

  it('falls back to probe score when no playback history exists', () => {
    const ranked = rankSourcesByPlaybackHealth(
      [
        { source: source('slow'), probeScore: 20, originalIndex: 0 },
        { source: source('fast'), probeScore: 80, originalIndex: 1 },
      ],
      {},
      2000
    );

    expect(ranked.map((item) => item.source.source)).toEqual(['fast', 'slow']);
  });
});
