import { isDirectTitleMatch } from '@/lib/search-title-match';

describe('search result title classification', () => {
  it('treats simplified and traditional title text as a direct match', () => {
    expect(isDirectTitleMatch('芙莉蓮', '葬送的芙莉莲')).toBe(true);
    expect(isDirectTitleMatch('芙利蓮', '葬送的芙莉莲')).toBe(false);
  });

  it('ignores punctuation around content qualifiers', () => {
    expect(
      isDirectTitleMatch('芙莉蓮电影解说', '葬送的芙莉莲[电影解说]')
    ).toBe(true);
  });
});
