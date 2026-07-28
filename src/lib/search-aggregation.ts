import { SearchResult } from './types';

export type SearchContentKind =
  | 'regular'
  | 'commentary'
  | 'special'
  | 'theatrical'
  | 'trailer';

export interface SearchTitleIdentity {
  baseTitle: string;
  season: number | null;
  contentKind: SearchContentKind;
  mediaType: 'movie' | 'series' | 'unknown';
}

export type AggregatedSearchGroup = [string, SearchResult[]];

const CHINESE_DIGITS: Record<string, number> = {
  一: 1,
  二: 2,
  两: 2,
  兩: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};

function parseSeasonNumber(value: string): number | null {
  if (/^\d+$/.test(value)) return Number(value);
  if (value === '十') return 10;
  if (value.startsWith('十')) {
    return 10 + (CHINESE_DIGITS[value.slice(1)] || 0);
  }
  if (value.endsWith('十')) {
    return (CHINESE_DIGITS[value.slice(0, -1)] || 0) * 10;
  }
  if (value.includes('十')) {
    const [tens, ones] = value.split('十');
    return (CHINESE_DIGITS[tens] || 1) * 10 + (CHINESE_DIGITS[ones] || 0);
  }
  return CHINESE_DIGITS[value] || null;
}

function normalizeSpacing(value: string): string {
  let result = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  let previous = '';
  while (previous !== result) {
    previous = result;
    result = result.replace(
      /([\u3400-\u9fff\uf900-\ufaff])\s+(?=[\u3400-\u9fff\uf900-\ufaff])/g,
      '$1'
    );
  }
  return result;
}

function inferContentKind(title: string): SearchContentKind {
  if (/(?:电影|電影)?解说|講解/.test(title)) return 'commentary';
  if (/预告|預告|花絮|幕后|幕後/.test(title)) return 'trailer';
  if (/剧场版|劇場版|movie|电影版|電影版/i.test(title)) return 'theatrical';
  if (/特别篇|特別篇|番外|ova|oad|\bsp\b/i.test(title)) return 'special';
  return 'regular';
}

function inferMediaType(result: SearchResult): 'movie' | 'series' | 'unknown' {
  const type = `${result.type_name || ''} ${result.class || ''}`;
  if (/解说|講解/.test(type)) return 'unknown';
  if (/电影|電影|movie/i.test(type)) return 'movie';
  if (
    /电视剧|電視劇|连续剧|連續劇|剧集|劇集|动漫|動漫|动画|動畫|综艺|綜藝|国产剧|韓劇|韩剧|日剧|日劇|美剧|美劇|英剧|英劇/i.test(
      type
    )
  ) {
    return 'series';
  }
  return 'unknown';
}

export function getSearchTitleIdentity(
  result: SearchResult
): SearchTitleIdentity {
  let normalized = normalizeSpacing(result.title)
    .replace(/[【〔［]/g, '[')
    .replace(/[】〕］]/g, ']');

  let season: number | null = null;
  const chineseSeason = normalized.match(
    /第([一二三四五六七八九十两兩\d]+)季/i
  );
  const westernSeason = normalized.match(/(?:\bseason\s*|\bs\s*)0*(\d+)\b/i);
  const sequelNumber = normalized.match(/(?<!\d)([2-9]|\d{2})$/);
  const seasonMatch = chineseSeason || westernSeason || sequelNumber;
  if (seasonMatch) {
    season = parseSeasonNumber(seasonMatch[1]);
    normalized = normalized.replace(seasonMatch[0], '');
  }

  const contentKind = inferContentKind(normalized);
  normalized = normalized
    .replace(/(?:\[|\(|（)?(?:电影|電影)?(?:解说|講解)(?:\]|\)|）)?/gi, '')
    .replace(/(?:\[|\(|（)?(?:预告|預告|花絮|幕后|幕後)(?:\]|\)|）)?/gi, '')
    .replace(/(?:\[|\(|（)?(?:剧场版|劇場版|movie|电影版|電影版)(?:\]|\)|）)?/gi, '')
    .replace(/(?:\[|\(|（)?(?:特别篇|特別篇|番外|ova|oad|sp)(?:\]|\)|）)?/gi, '')
    .replace(/\[|\]|\(|\)|（|）/g, '')
    .replace(/[·•:：,，.。_\-—]/g, '')
    .replace(/\s+/g, '')
    .toLocaleLowerCase();

  return {
    baseTitle: normalized,
    season,
    contentKind,
    mediaType: inferMediaType(result),
  };
}

function identityKey(result: SearchResult): string {
  const identity = getSearchTitleIdentity(result);
  return [
    identity.baseTitle,
    `season:${identity.season ?? 0}`,
    identity.contentKind,
    identity.mediaType,
  ].join('|');
}

function knownYear(result: SearchResult): string | null {
  return /^\d{4}$/.test(result.year) ? result.year : null;
}

function canJoinGroup(result: SearchResult, group: SearchResult[]): boolean {
  const first = group[0];
  const resultIdentity = getSearchTitleIdentity(result);
  const firstIdentity = getSearchTitleIdentity(first);
  if (
    resultIdentity.baseTitle !== firstIdentity.baseTitle ||
    resultIdentity.season !== firstIdentity.season ||
    resultIdentity.contentKind !== firstIdentity.contentKind
  ) {
    return false;
  }

  const knownGroupMediaTypes = new Set(
    group
      .map((item) => getSearchTitleIdentity(item).mediaType)
      .filter((mediaType) => mediaType !== 'unknown')
  );
  if (
    resultIdentity.mediaType !== 'unknown' &&
    knownGroupMediaTypes.size > 0 &&
    !knownGroupMediaTypes.has(resultIdentity.mediaType)
  ) {
    return false;
  }

  const resultDouban = result.douban_id || 0;
  const groupDoubanIds = new Set(
    group.map((item) => item.douban_id || 0).filter(Boolean)
  );
  if (
    resultDouban &&
    groupDoubanIds.size > 0 &&
    !groupDoubanIds.has(resultDouban)
  ) {
    return false;
  }

  const resultYear = knownYear(result);
  const groupYears = new Set(group.map(knownYear).filter(Boolean));
  if (resultYear && groupYears.size > 0 && !groupYears.has(resultYear)) {
    return false;
  }
  return true;
}

export function aggregateSearchResults(
  results: SearchResult[]
): AggregatedSearchGroup[] {
  const groups: SearchResult[][] = [];

  const sorted = [...results].sort((a, b) => {
    const aKnown =
      Number(Boolean(a.douban_id)) +
      Number(Boolean(knownYear(a))) +
      Number(getSearchTitleIdentity(a).mediaType !== 'unknown');
    const bKnown =
      Number(Boolean(b.douban_id)) +
      Number(Boolean(knownYear(b))) +
      Number(getSearchTitleIdentity(b).mediaType !== 'unknown');
    return bKnown - aKnown;
  });

  for (const result of sorted) {
    const compatible = groups.filter((group) => canJoinGroup(result, group));
    if (compatible.length === 1) compatible[0].push(result);
    else groups.push([result]);
  }

  return groups.map((group) => {
    const years = Array.from(new Set(group.map(knownYear).filter(Boolean)));
    const doubanIds = Array.from(
      new Set(group.map((item) => item.douban_id || 0).filter(Boolean))
    );
    const key = [
      identityKey(group[0]),
      `year:${years[0] || 'unknown'}`,
      `douban:${doubanIds[0] || 0}`,
    ].join('|');
    return [key, group] as AggregatedSearchGroup;
  });
}
