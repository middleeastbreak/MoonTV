export interface SeasonDownloadEpisode {
  url: string;
  title: string;
}

export function buildSeasonDownloadEpisodes(
  title: string,
  urls: string[],
  episodeTitles: string[] = []
): SeasonDownloadEpisode[] {
  return urls.flatMap((url, index) => {
    const normalizedUrl = url.trim();
    if (!normalizedUrl) return [];
    const episodeTitle = episodeTitles[index]?.trim() || `第${index + 1}集`;
    return [{ url: normalizedUrl, title: `${title}_${episodeTitle}` }];
  });
}
