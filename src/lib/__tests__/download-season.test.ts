import { buildSeasonDownloadEpisodes } from '@/lib/download-season';

describe('whole-season download list', () => {
  it('keeps only the current season and gives every valid episode a filename', () => {
    expect(
      buildSeasonDownloadEpisodes(
        '问心2',
        ['episode-1.m3u8', '', ' episode-3.m3u8 '],
        ['第一集', '第二集']
      )
    ).toEqual([
      { url: 'episode-1.m3u8', title: '问心2_第一集' },
      { url: 'episode-3.m3u8', title: '问心2_第3集' },
    ]);
  });

  it('removes duplicate URLs and prevents duplicate filenames', () => {
    expect(
      buildSeasonDownloadEpisodes(
        '作品',
        ['episode-1.m3u8', 'episode-1.m3u8', 'episode-3.m3u8'],
        ['正片', '正片', '正片']
      )
    ).toEqual([
      { url: 'episode-1.m3u8', title: '作品_正片' },
      { url: 'episode-3.m3u8', title: '作品_第3集' },
    ]);
  });
});
