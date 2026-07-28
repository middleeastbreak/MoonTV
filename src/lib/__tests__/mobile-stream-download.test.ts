import { isServiceWorkerDownloadSafe } from '@/lib/stream-saver';

describe('mobile Service Worker downloads', () => {
  it('rejects iPad Safari before it can save a video as .ts.html', () => {
    expect(
      isServiceWorkerDownloadSafe({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
        platform: 'MacIntel',
        maxTouchPoints: 5,
      })
    ).toBe(false);
  });

  it('keeps Service Worker streaming available on desktop Chrome', () => {
    expect(
      isServiceWorkerDownloadSafe({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
        platform: 'Win32',
        maxTouchPoints: 0,
      })
    ).toBe(true);
  });
});
