import OpenCC from 'opencc-js';

const toSimplified = OpenCC.Converter({ from: 't', to: 'cn' });

interface EpisodeIdentity {
  normalized: string;
  date: string | null;
  releaseNumber: number | null;
  part: number | null;
  episode: number | null;
  tags: Set<string>;
  residual: string;
}

export interface EpisodeMatchInput {
  currentIndex: number;
  currentTitles?: string[];
  targetTitles?: string[];
  currentEpisodeCount?: number;
  targetEpisodeCount?: number;
}

const CHINESE_DIGITS: Record<string, number> = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  if (/^\d+$/.test(value)) return Number(value);
  if (value === '十') return 10;
  const tenIndex = value.indexOf('十');
  if (tenIndex >= 0) {
    const tens = tenIndex === 0 ? 1 : CHINESE_DIGITS[value[tenIndex - 1]];
    const units =
      tenIndex === value.length - 1 ? 0 : CHINESE_DIGITS[value[tenIndex + 1]];
    return tens === undefined || units === undefined ? null : tens * 10 + units;
  }
  if (value.length === 1) return CHINESE_DIGITS[value] ?? null;
  return null;
}

function normalizeTitle(value: string): string {
  return toSimplified(value.normalize('NFKC'))
    .toLocaleLowerCase()
    .replace(/[\s!-/:-@[-`{-~，。！？：；、“”‘’（）【】《》·—…￥]+/g, '');
}

function episodeIdentity(value: string): EpisodeIdentity {
  const text = toSimplified(value.normalize('NFKC')).toLocaleLowerCase();
  const normalized = normalizeTitle(text);
  const date = normalized.match(/(?:19|20)\d{6}/)?.[0] || null;
  const withoutDate = date ? normalized.replace(date, '') : normalized;
  const releaseNumber = parseNumber(
    withoutDate.match(/第([0-9零〇一二两三四五六七八九十]+)期/)?.[1]
  );
  const tags = new Set(
    [
      '先导',
      '预热',
      '预告',
      '花絮',
      '纯享',
      '加更',
      '抢先',
      '超长',
      '舞台',
      '合集',
      '通告',
      '收工',
      '幕后',
      '未播',
      '彩蛋',
    ].filter((tag) => normalized.includes(tag))
  );

  const parenthesizedPart = text.match(
    /\(([0-9零〇一二两三四五六七八九十]+)\)\s*$/
  )?.[1];
  const suffixPart = date
    ? normalized.match(
        /期(?:第)?([0-9零〇一二两三四五六七八九十]+)(?:部分|段)?$/
      )?.[1]
    : undefined;
  const directionalPart =
    normalized.match(/期(上|中|下)/)?.[1] ||
    normalized.match(/(上|中|下)(?:集|部)/)?.[1] ||
    normalized.match(/(上|中|下)$/)?.[1];
  const part =
    parseNumber(parenthesizedPart || suffixPart) ??
    (directionalPart === '上'
      ? 1
      : directionalPart === '中'
      ? 2
      : directionalPart === '下'
      ? 3
      : null);

  let episode: number | null = null;
  if (!date && !/^\d+[-~至]\d+$/.test(normalized)) {
    const match = normalized.match(
      /(?:第|ep?|episode)([0-9零〇一二两三四五六七八九十]+)(?:集|期)?$/
    );
    const plainNumber = normalized.match(/^([0-9]+)$/)?.[1];
    episode = parseNumber(match?.[1] || plainNumber);
  }

  let residual = withoutDate
    .replace(/第[0-9零〇一二两三四五六七八九十]+期/g, '')
    .replace(/第?期/g, '')
    .replace(
      /(?:先导|预热|预告|花絮|纯享|加更|抢先|超长|舞台|合集|通告|收工|幕后|未播|彩蛋)/g,
      ''
    )
    .replace(/(上|中|下)(?:集|部)/g, '')
    .replace(/(?:版|片)$/g, '');
  if (
    part !== null &&
    /^[0-9零〇一二两三四五六七八九十上中下]+$/.test(residual)
  ) {
    residual = '';
  }

  return {
    normalized,
    date,
    releaseNumber,
    part,
    episode,
    tags,
    residual,
  };
}

function tagCompatibility(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) {
    return left.size === right.size ? 1 : -1;
  }
  const shared = Array.from(left).filter((tag) => right.has(tag)).length;
  if (shared === 0) return -1;
  return shared / Math.max(left.size, right.size);
}

function identitiesMatch(left: EpisodeIdentity, right: EpisodeIdentity) {
  if (!left.normalized || !right.normalized) return false;
  if (
    left.releaseNumber !== null &&
    right.releaseNumber !== null &&
    left.releaseNumber !== right.releaseNumber
  ) {
    return false;
  }
  if (left.normalized === right.normalized) return true;
  if (left.date || right.date) {
    const compatibleTags = tagCompatibility(left.tags, right.tags);
    const residualsMatch =
      left.residual === right.residual ||
      (!left.residual && !right.residual) ||
      (left.residual.length >= 2 && right.residual.includes(left.residual)) ||
      (right.residual.length >= 2 && left.residual.includes(right.residual));
    const structuredPartMatch =
      left.part !== null &&
      right.part !== null &&
      left.part === right.part &&
      compatibleTags >= 0.5;
    return (
      Boolean(left.date) &&
      left.date === right.date &&
      (left.part || null) === (right.part || null) &&
      compatibleTags >= 0.5 &&
      (residualsMatch || structuredPartMatch)
    );
  }
  return (
    left.episode !== null &&
    right.episode !== null &&
    left.episode === right.episode
  );
}

function matchScore(left: EpisodeIdentity, right: EpisodeIdentity): number {
  if (!identitiesMatch(left, right)) return -1;
  if (left.normalized === right.normalized) return 100;
  const tagScore = tagCompatibility(left.tags, right.tags);
  const releaseNumberScore =
    left.releaseNumber !== null && right.releaseNumber !== null ? 3 : 0;
  return 10 + Math.max(0, tagScore) * 5 + releaseNumberScore;
}

/** Return only a unique episode identity; do not guess from a shifted index. */
export function findMatchingEpisodeIndex({
  currentIndex,
  currentTitles = [],
  targetTitles = [],
  currentEpisodeCount = currentTitles.length,
  targetEpisodeCount = targetTitles.length,
}: EpisodeMatchInput): number | null {
  if (currentIndex < 0 || currentIndex >= currentEpisodeCount) return null;

  const currentTitle = currentTitles[currentIndex]?.trim();
  if (currentTitle && targetTitles.length > 0) {
    const currentIdentity = episodeIdentity(currentTitle);
    const matches = targetTitles
      .map((title, index) => ({
        identity: episodeIdentity(title || ''),
        index,
      }))
      .map(({ identity, index }) => ({
        index,
        score: matchScore(currentIdentity, identity),
      }))
      .filter(({ score }) => score >= 0)
      .sort((left, right) => right.score - left.score);
    if (matches.length === 0) return null;
    if (matches.length > 1 && matches[0].score === matches[1].score)
      return null;
    return matches[0].index;
  }

  const hasCurrentTitles = currentTitles.some((title) => title?.trim());
  const hasTargetTitles = targetTitles.some((title) => title?.trim());
  if (
    !hasCurrentTitles &&
    !hasTargetTitles &&
    currentEpisodeCount === targetEpisodeCount &&
    currentIndex < targetEpisodeCount
  ) {
    return currentIndex;
  }
  return null;
}
