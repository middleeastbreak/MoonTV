import {
  aggregateSearchResults,
  getSearchTitleIdentity,
} from '@/lib/search-aggregation';
import { SearchResult } from '@/lib/types';

function result(
  title: string,
  options: Partial<SearchResult> = {}
): SearchResult {
  return {
    id: title,
    title,
    poster: '',
    episodes: Array.from({ length: 12 }, (_, index) => `${index}`),
    episodes_titles: [],
    source: options.source || title,
    source_name: options.source_name || title,
    year: options.year || '2026',
    type_name: options.type_name || '动漫',
    ...options,
  };
}

describe('search result aggregation', () => {
  it('merges equivalent season spellings but keeps base and commentary separate', () => {
    const input = [
      result('葬送的芙莉莲', { year: '2023' }),
      result('葬送的芙莉莲 第二季'),
      result('葬送的芙莉莲[电影解说]', {
        year: '2023',
        type_name: '电影解说',
        episodes: ['commentary'],
      }),
      result('葬送的芙莉莲第二季'),
      result('葬送的芙莉莲 S2'),
      result('葬送的芙莉莲 第2季'),
    ];

    const groups = aggregateSearchResults(input);
    expect(groups).toHaveLength(3);
    expect(groups.map(([, group]) => group.length).sort()).toEqual([1, 1, 4]);
    expect(groups.flatMap(([, group]) => group)).toHaveLength(input.length);
  });

  it('keeps known conflicting years and douban ids separate', () => {
    const groups = aggregateSearchResults([
      result('同名作品', { year: '2024', douban_id: 1 }),
      result('同名作品', { year: '2025', douban_id: 1 }),
      result('同名作品', { year: '2024', douban_id: 2 }),
    ]);
    expect(groups).toHaveLength(3);
  });

  it('does not infer media type from episode count', () => {
    const groups = aggregateSearchResults([
      result('更新中的动画', { episodes: ['1'], source: 'a' }),
      result('更新中的动画', {
        episodes: ['1', '2', '3'],
        source: 'b',
      }),
    ]);
    expect(groups).toHaveLength(1);
  });

  it('lets unknown media metadata join one compatible known group', () => {
    const groups = aggregateSearchResults([
      result('作品', { source: 'unknown', type_name: '' }),
      result('作品', { source: 'series', type_name: '电视剧' }),
    ]);

    expect(groups).toHaveLength(1);
  });

  it('keeps ambiguous unknown metadata separate from known movies and series', () => {
    const groups = aggregateSearchResults([
      result('作品', { source: 'unknown', type_name: '' }),
      result('作品', { source: 'series', type_name: '电视剧' }),
      result('作品', { source: 'movie', type_name: '电影' }),
    ]);

    expect(groups).toHaveLength(3);
  });

  it('extracts a stable season identity', () => {
    expect(getSearchTitleIdentity(result('作品 第十二季')).season).toBe(12);
    expect(getSearchTitleIdentity(result('作品 Season 02')).season).toBe(2);
  });

  it('keeps a numbered sequel separate from the base title', () => {
    const groups = aggregateSearchResults([
      result('问心', { year: '2026', source: 'base' }),
      result('问心2', { year: '2026', source: 'sequel-a' }),
      result('问心 第二季', { year: '2026', source: 'sequel-b' }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.map(([, group]) => group.length).sort()).toEqual([1, 2]);
  });
});
