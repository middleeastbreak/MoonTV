export interface SeasonDownloadEpisode {
  url: string;
  title: string;
}

export function buildSeasonDownloadEpisodes(
  title: string,
  urls: string[],
  episodeTitles: string[] = []
): SeasonDownloadEpisode[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();

  return urls.flatMap((url, index) => {
    const normalizedUrl = url.trim();
    if (!normalizedUrl || seenUrls.has(normalizedUrl)) return [];
    seenUrls.add(normalizedUrl);

    const episodeTitle = episodeTitles[index]?.trim() || `第${index + 1}集`;
    let filename = `${title}_${episodeTitle}`;
    if (seenTitles.has(filename)) filename = `${title}_第${index + 1}集`;
    let suffix = 2;
    const baseFilename = filename;
    while (seenTitles.has(filename)) {
      filename = `${baseFilename}_${suffix}`;
      suffix += 1;
    }
    seenTitles.add(filename);

    return [{ url: normalizedUrl, title: filename }];
  });
}

export function isMobileDownloadDevice(userAgent: string): boolean {
  return /Android|iPhone|iPad|iPod|Macintosh.*Mobile/i.test(userAgent);
}
