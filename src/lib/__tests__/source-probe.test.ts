import { SearchResult } from '@/lib/types';
import { getSourceEpisodeForProbe } from '@/lib/utils';

const source = (episodes: string[]): SearchResult => ({
  id: 'id',
  title: '作品',
  poster: '',
  episodes,
  episodes_titles: [],
  source: 'source',
  source_name: 'source',
  year: '2026',
  type_name: '剧集',
});

describe('source probe episode selection', () => {
  it('probes the episode the user is currently watching', () => {
    expect(getSourceEpisodeForProbe(source(['ep-1', 'ep-2', 'ep-3']), 2)).toBe(
      'ep-3'
    );
  });

  it('does not probe an unrelated episode when the current one is missing', () => {
    expect(getSourceEpisodeForProbe(source(['ep-1']), 2)).toBeNull();
  });
});
