import { generateFuzzyQueries, scoreFuzzyTitle } from '@/lib/search-fuzzy';

describe('fuzzy title matching', () => {
  it('matches short phonetic variants inside a longer title', () => {
    const match = scoreFuzzyTitle('芙利莲', '葬送的芙莉蓮 第二季');
    expect(match).not.toBeNull();
    expect(match?.matchedText).toBe('芙莉莲');
    expect(match?.matchType).toBe('phonetic');
  });

  it('rejects unrelated titles with a partially similar pronunciation', () => {
    expect(scoreFuzzyTitle('芙利莲', '福利院的故事')).toBeNull();
  });

  it('matches a content qualifier while preserving the original title script', () => {
    expect(
      scoreFuzzyTitle('芙莉蓮电影解说', '葬送的芙莉莲[电影解说]')
    ).not.toBeNull();
  });

  it('creates at most two complementary fallback queries', () => {
    expect(generateFuzzyQueries('凡人修先传')).toEqual(['凡人', '先传']);
    expect(generateFuzzyQueries('芙利莲')).toEqual(['芙利', '利莲']);
    expect(generateFuzzyQueries('问心2')).toEqual(['问心', '心2']);
    expect(generateFuzzyQueries('芙莉蓮电影解说')).toEqual([
      '芙莉蓮',
      '电影解说',
    ]);
  });

  it('does not broaden two-character Chinese queries', () => {
    expect(generateFuzzyQueries('问心')).toEqual([]);
  });
});
