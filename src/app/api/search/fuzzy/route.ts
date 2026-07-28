/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getAvailableApiSites, getCacheTime, getConfig } from '@/lib/config';
import { searchFromApiStream } from '@/lib/downstream';
import { generateFuzzyQueries, scoreFuzzyTitle } from '@/lib/search-fuzzy';
import { SearchResult } from '@/lib/types';
import { yellowWords } from '@/lib/yellow';

export const runtime = 'nodejs';

interface FuzzySearchResult extends SearchResult {
  fuzzy_score: number;
  fuzzy_match_type: 'text' | 'phonetic';
  fuzzy_matched_text: string;
}

export async function GET(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  const authInfo =
    storageType === 'localstorage' ? null : getAuthInfoFromCookie(request);
  if (storageType !== 'localstorage' && !authInfo?.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim() || '';
  const fallbackQueries = generateFuzzyQueries(query).slice(0, 2);
  if (!query || fallbackQueries.length === 0) {
    return NextResponse.json({ results: [], fallbackQueries: [] });
  }

  const timeoutParam = searchParams.get('timeout');
  const timeout = timeoutParam ? parseInt(timeoutParam, 10) * 1000 : undefined;
  let sites = await getAvailableApiSites(authInfo?.username);
  const selectedSources = searchParams
    .get('sources')
    ?.split(',')
    .filter(Boolean);
  if (selectedSources?.length) {
    const allowed = new Set(selectedSources);
    sites = sites.filter((site) => allowed.has(site.key));
  }

  const config = await getConfig();
  const collected = new Map<string, SearchResult>();
  await Promise.allSettled(
    sites.flatMap((site) =>
      fallbackQueries.map(async (fallbackQuery) => {
        let count = 0;
        for await (const batch of searchFromApiStream(
          site,
          fallbackQuery,
          true,
          timeout
        )) {
          for (const result of batch) {
            if (count >= 50) break;
            const typeName = result.type_name || '';
            if (
              !config.SiteConfig.DisableYellowFilter &&
              yellowWords.some((word) => typeName.includes(word))
            ) {
              continue;
            }
            collected.set(`${result.source}:${result.id}`, result);
            count += 1;
          }
          if (count >= 50) break;
        }
      })
    )
  );

  const results: FuzzySearchResult[] = [];
  for (const result of Array.from(collected.values())) {
    const match = scoreFuzzyTitle(query, result.title);
    if (!match) continue;
    results.push({
      ...result,
      fuzzy_score: Number(match.score.toFixed(4)),
      fuzzy_match_type: match.matchType,
      fuzzy_matched_text: match.matchedText,
    });
  }
  results.sort((a, b) => b.fuzzy_score - a.fuzzy_score);

  const cacheTime = await getCacheTime();
  return NextResponse.json(
    { results: results.slice(0, 40), fallbackQueries },
    { headers: { 'Cache-Control': `private, max-age=${cacheTime}` } }
  );
}
