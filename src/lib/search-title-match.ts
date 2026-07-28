import OpenCC from 'opencc-js';

const toSimplified = OpenCC.Converter({ from: 't', to: 'cn' });

export function normalizeSearchTitleText(value: string): string {
  return toSimplified(value.normalize('NFKC'))
    .toLocaleLowerCase()
    .replace(/[\s!-/:-@[-`{-~，。！？：；、“”‘’（）【】《》·—…￥]+/g, '');
}

export function isDirectTitleMatch(query: string, title: string): boolean {
  const normalizedQuery = normalizeSearchTitleText(query);
  if (!normalizedQuery) return false;
  return normalizeSearchTitleText(title).includes(normalizedQuery);
}
