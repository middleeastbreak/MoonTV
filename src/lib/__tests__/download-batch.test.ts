import {
  createSeasonDownloadQueue,
  runSeasonDownloadQueue,
} from '@/lib/download-batch';

describe('whole-season download queue', () => {
  it('adds the complete season at once, then starts one episode at a time', async () => {
    const episodes = [
      { url: 'episode-1.m3u8', title: '第一集' },
      { url: 'episode-2.m3u8', title: '第二集' },
      { url: 'episode-3.m3u8', title: '第三集' },
    ];
    const queue = createSeasonDownloadQueue(episodes, 1_000);

    expect(queue).toHaveLength(3);
    expect(queue.map((item) => item.status)).toEqual([
      'waiting',
      'waiting',
      'waiting',
    ]);

    const active: string[] = [];
    let maxActive = 0;
    const started: string[] = [];
    await runSeasonDownloadQueue(queue, async (item) => {
      started.push(item.id);
      active.push(item.id);
      maxActive = Math.max(maxActive, active.length);
      await Promise.resolve();
      active.pop();
    });

    expect(started).toEqual(queue.map((item) => item.id));
    expect(maxActive).toBe(1);
  });
});
