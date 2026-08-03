import { findMatchingEpisodeIndex } from '@/lib/source-episode-match';

describe('cross-source episode matching', () => {
  const currentTitles = [
    '1-50',
    '51-55',
    '20260702先导片',
    '20260703第1期(一)',
    '20260703第1期(二)',
    '20260703第1期(三)',
  ];
  const targetTitles = [
    '第20260702期先导片',
    '第20260703期一',
    '第20260703期二',
    '第20260703期三',
  ];

  it('matches a dated preview by identity instead of reusing its array index', () => {
    expect(
      findMatchingEpisodeIndex({
        currentIndex: 2,
        currentTitles,
        targetTitles,
      })
    ).toBe(0);
  });

  it('matches a dated multipart episode despite different naming syntax', () => {
    expect(
      findMatchingEpisodeIndex({
        currentIndex: 4,
        currentTitles,
        targetTitles,
      })
    ).toBe(2);
  });

  it('refuses an ambiguous dated episode instead of guessing by index', () => {
    expect(
      findMatchingEpisodeIndex({
        currentIndex: 3,
        currentTitles,
        targetTitles: ['第20260703期一', '20260703(一)'],
      })
    ).toBeNull();
  });

  it.each([
    ['20260703第1期(一)', '20260703第2期(一)'],
    ['20260703第一期(一)', '20260703第二期(一)'],
  ])(
    'rejects a sole candidate with a conflicting release number',
    (currentTitle, targetTitle) => {
      expect(
        findMatchingEpisodeIndex({
          currentIndex: 0,
          currentTitles: [currentTitle],
          targetTitles: [targetTitle],
        })
      ).toBeNull();
    }
  );

  it('matches ordinary numbered episodes across common title formats', () => {
    expect(
      findMatchingEpisodeIndex({
        currentIndex: 11,
        currentTitles: Array.from({ length: 12 }, (_, index) => `${index + 1}`),
        targetTitles: Array.from(
          { length: 12 },
          (_, index) => `第${index + 1}集`
        ),
      })
    ).toBe(11);
  });

  it('allows index fallback only when both untitled sources have equal counts', () => {
    expect(
      findMatchingEpisodeIndex({
        currentIndex: 2,
        currentEpisodeCount: 4,
        targetEpisodeCount: 4,
      })
    ).toBe(2);
    expect(
      findMatchingEpisodeIndex({
        currentIndex: 2,
        currentEpisodeCount: 6,
        targetEpisodeCount: 4,
      })
    ).toBeNull();
  });

  it('distinguishes regular and pure-cut upper parts released on the same date', () => {
    const sourceTitles = [
      '20260717第3期(一)',
      '20260717第3期(二)',
      '20260717第3期超长抢先',
      '20260717第3期纯享上集',
    ];
    const otherSourceTitles = [
      '第20260717期一',
      '第20260717期二',
      '20260717超长抢先片',
      '20260717上部纯享版',
    ];

    expect(
      findMatchingEpisodeIndex({
        currentIndex: 0,
        currentTitles: sourceTitles,
        targetTitles: otherSourceTitles,
      })
    ).toBe(0);
    expect(
      findMatchingEpisodeIndex({
        currentIndex: 3,
        currentTitles: sourceTitles,
        targetTitles: otherSourceTitles,
      })
    ).toBe(3);
  });

  it('matches descriptive pure-cut collections without confusing upper and lower parts', () => {
    const sourceTitles = [
      '20260719第3期上集高分舞台纯享合集',
      '20260719第3期下集高分舞台纯享合集',
    ];
    const otherSourceTitles = [
      '第20260719期下部 舞台纯享合集',
      '第20260719期上部 高分舞台纯享',
    ];

    expect(
      findMatchingEpisodeIndex({
        currentIndex: 0,
        currentTitles: sourceTitles,
        targetTitles: otherSourceTitles,
      })
    ).toBe(1);
    expect(
      findMatchingEpisodeIndex({
        currentIndex: 1,
        currentTitles: sourceTitles,
        targetTitles: otherSourceTitles,
      })
    ).toBe(0);
  });

  it('does not guess between multiple descriptive clips from the same date', () => {
    expect(
      findMatchingEpisodeIndex({
        currentIndex: 0,
        currentTitles: ['20260720白磷型人格'],
        targetTitles: ['20260720喜单纯享', '20260720巅峰对决'],
      })
    ).toBeNull();
  });

  it.each([
    ['20260711第2期纯享下集', '第20260711期下纯享版'],
    ['20260711第2期(四)', '第20260711期四'],
    ['20260712第2期上', '第20260712期上部'],
    ['20260712第2期加更', '20260712加更版'],
    ['20260713', '第20260713期'],
    ['20260717第3期超长抢先', '20260717超长抢先片'],
    ['20260720(桃厂通告日)', '20260720桃厂通告日'],
    ['20260723(纯享版)', '第20260723期纯享'],
  ])('matches another naming variant: %s', (currentTitle, targetTitle) => {
    expect(
      findMatchingEpisodeIndex({
        currentIndex: 0,
        currentTitles: [currentTitle],
        targetTitles: [targetTitle],
      })
    ).toBe(0);
  });
});
