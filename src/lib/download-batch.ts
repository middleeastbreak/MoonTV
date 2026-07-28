export interface SeasonDownloadEpisode {
  url: string;
  title: string;
}

export interface SeasonDownloadQueueItem extends SeasonDownloadEpisode {
  id: string;
  status: 'waiting';
}

export function createSeasonDownloadQueue(
  episodes: SeasonDownloadEpisode[],
  batchId = Date.now()
): SeasonDownloadQueueItem[] {
  return episodes.map((episode, index) => ({
    ...episode,
    id: `${batchId}-${index}`,
    status: 'waiting',
  }));
}

export async function runSeasonDownloadQueue(
  queue: SeasonDownloadQueueItem[],
  runEpisode: (item: SeasonDownloadQueueItem, index: number) => Promise<void>
): Promise<void> {
  for (let index = 0; index < queue.length; index += 1) {
    await runEpisode(queue[index], index);
  }
}
