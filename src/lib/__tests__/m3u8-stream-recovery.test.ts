const mockCreateWriteStream = jest.fn();
const originalFetch = global.fetch;

jest.mock('@/lib/stream-saver', () => ({
  createWriteStream: mockCreateWriteStream,
}));

import {
  downloadM3U8Video,
  getEffectiveDownloadConcurrency,
  getSegmentRetryDelay,
  M3U8Task,
  resetStreamingDownloadProgress,
} from '@/lib/m3u8-downloader';

function task(): M3U8Task {
  return {
    url: 'https://example.com/video.m3u8',
    title: '测试视频',
    type: 'TS',
    tsUrlList: ['https://example.com/1.ts'],
    finishList: [{ title: '1.ts', status: '' }],
    downloadIndex: 0,
    finishNum: 0,
    errorNum: 0,
    aesConf: { method: '', uri: '', iv: '', key: '' },
    durationSecond: 10,
    segmentDurations: [10],
    rangeDownload: { startSegment: 1, endSegment: 1, targetSegment: 1 },
  };
}

describe('streaming download recovery', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    mockCreateWriteStream.mockReset();
    if (originalFetch) global.fetch = originalFetch;
    else Reflect.deleteProperty(global, 'fetch');
  });

  it('limits Service Worker requests without slowing other modes', () => {
    expect(getEffectiveDownloadConcurrency(6, 'service-worker')).toBe(3);
    expect(getEffectiveDownloadConcurrency(2, 'service-worker')).toBe(2);
    expect(getEffectiveDownloadConcurrency(6, 'file-system')).toBe(6);
    expect(getEffectiveDownloadConcurrency(6, 'disabled')).toBe(6);
  });

  it('backs retries off while keeping deterministic jitter bounds', () => {
    expect(getSegmentRetryDelay(0, 0.5)).toBe(1000);
    expect(getSegmentRetryDelay(1, 0.5)).toBe(2000);
    expect(getSegmentRetryDelay(2, 0.5)).toBe(4000);
    expect(getSegmentRetryDelay(5, 0.5)).toBe(8000);
    expect(getSegmentRetryDelay(1, 0)).toBe(1600);
    expect(getSegmentRetryDelay(1, 1)).toBe(2400);
  });

  it('aborts an incomplete stream instead of skipping a failed segment', async () => {
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    const abort = jest.fn();
    const close = jest.fn();
    mockCreateWriteStream.mockReturnValue({
      getWriter: () => ({
        abort,
        close,
        write: jest.fn(),
      }),
    } as unknown as WritableStream<Uint8Array>);
    global.fetch = jest
      .fn()
      .mockRejectedValue(
        new TypeError('Failed to fetch')
      ) as jest.MockedFunction<typeof fetch>;

    await expect(
      downloadM3U8Video(
        task(),
        undefined,
        undefined,
        undefined,
        6,
        'service-worker',
        0
      )
    ).rejects.toThrow('片段 1 下载失败');

    expect(abort).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });

  it('restarts an aborted stream from the beginning', () => {
    const retryTask = task();
    retryTask.finishList[0] = {
      title: '1.ts',
      status: 'error',
      retryCount: 3,
    };
    retryTask.finishNum = 12;
    retryTask.errorNum = 1;
    retryTask.downloadedSegments = new Map([[0, new ArrayBuffer(1)]]);

    resetStreamingDownloadProgress(retryTask);

    expect(retryTask.finishList[0]).toEqual({
      title: '1.ts',
      status: '',
      retryCount: 0,
    });
    expect(retryTask.finishNum).toBe(0);
    expect(retryTask.errorNum).toBe(0);
    expect(retryTask.downloadedSegments?.size).toBe(0);
  });
});
