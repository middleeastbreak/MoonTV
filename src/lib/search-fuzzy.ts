import OpenCC from 'opencc-js';
import { pinyin } from 'pinyin-pro';

const toSimplified = OpenCC.Converter({ from: 't', to: 'cn' });

export interface FuzzyTitleMatch {
  score: number;
  matchedText: string;
  matchType: 'text' | 'phonetic';
}

function codepoints(value: string): string[] {
  return Array.from(value);
}

export function normalizeFuzzyText(value: string): string {
  return toSimplified(value.normalize('NFKC'))
    .toLocaleLowerCase()
    .replace(/[\s!-/:-@[-`{-~，。！？：；、“”‘’（）【】《》·—…￥]+/g, '');
}

function pinyinTokens(value: string): string[] {
  return pinyin(value, { toneType: 'none', type: 'array' }).map((item) =>
    item.toLocaleLowerCase().replace(/[^a-z0-9]/g, '')
  );
}

export function damerauLevenshtein<T>(left: T[], right: T[]): number {
  const matrix = Array.from({ length: left.length + 1 }, () =>
    Array(right.length + 1).fill(0)
  );
  for (let i = 0; i <= left.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= right.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
      if (
        i > 1 &&
        j > 1 &&
        left[i - 1] === right[j - 2] &&
        left[i - 2] === right[j - 1]
      ) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + cost);
      }
    }
  }
  return matrix[left.length][right.length];
}

function similarity<T>(left: T[], right: T[]): number {
  const length = Math.max(left.length, right.length);
  if (length === 0) return 1;
  return 1 - damerauLevenshtein(left, right) / length;
}

function characterOverlap(left: string[], right: string[]): number {
  const remaining = [...right];
  let matches = 0;
  for (const character of left) {
    const index = remaining.indexOf(character);
    if (index >= 0) {
      matches += 1;
      remaining.splice(index, 1);
    }
  }
  return matches / Math.max(left.length, right.length, 1);
}

export function generateFuzzyQueries(query: string): string[] {
  const normalized = query
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\s!-/:-@[-`{-~，。！？：；、“”‘’（）【】《》·—…￥]+/g, '');
  const characters = codepoints(normalized);
  const isChinese = characters.some((character) =>
    /[\u3400-\u9fff\uf900-\ufaff]/.test(character)
  );

  if (isChinese) {
    if (characters.length < 3) return [];
    const qualifier = normalized.match(
      /(?:电影解说|電影解說|影视解说|影視解說|解说|解說)$/
    )?.[0];
    if (qualifier) {
      const core = normalized.slice(0, -qualifier.length);
      if (codepoints(core).length >= 2) {
        return Array.from(new Set([core, qualifier])).slice(0, 2);
      }
    }
    if (characters.length === 3) {
      return Array.from(
        new Set([
          characters.slice(0, 2).join(''),
          characters.slice(1).join(''),
        ])
      );
    }
    const size = Math.floor(characters.length / 2);
    return Array.from(
      new Set([
        characters.slice(0, size).join(''),
        characters.slice(-size).join(''),
      ])
    );
  }

  const words = query.normalize('NFKC').trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    const size = Math.max(1, Math.floor(words.length / 2));
    return Array.from(
      new Set([words.slice(0, size).join(' '), words.slice(-size).join(' ')])
    );
  }
  if (characters.length < 5) return [];
  const size = Math.floor(characters.length / 2);
  return [characters.slice(0, size).join(''), characters.slice(-size).join('')];
}

export function scoreFuzzyTitle(
  query: string,
  candidateTitle: string
): FuzzyTitleMatch | null {
  const normalizedQuery = normalizeFuzzyText(query);
  const normalizedTitle = normalizeFuzzyText(candidateTitle);
  const queryChars = codepoints(normalizedQuery);
  const titleChars = codepoints(normalizedTitle);
  if (queryChars.length < 3 || titleChars.length === 0) return null;

  const minWindow = Math.max(2, queryChars.length - 1);
  const maxWindow = Math.min(titleChars.length, queryChars.length + 1);
  let best: FuzzyTitleMatch | null = null;

  for (let size = minWindow; size <= maxWindow; size += 1) {
    for (let start = 0; start + size <= titleChars.length; start += 1) {
      const windowChars = titleChars.slice(start, start + size);
      const windowText = windowChars.join('');
      const textScore = similarity(queryChars, windowChars);
      const phoneticScore = similarity(
        pinyinTokens(normalizedQuery),
        pinyinTokens(windowText)
      );
      const overlap = characterOverlap(queryChars, windowChars);
      const score = phoneticScore * 0.55 + textScore * 0.35 + overlap * 0.1;
      const match: FuzzyTitleMatch = {
        score,
        matchedText: windowText,
        matchType: phoneticScore > textScore + 0.1 ? 'phonetic' : 'text',
      };
      if (!best || match.score > best.score) best = match;
    }
  }

  return best && best.score >= 0.72 ? best : null;
}
