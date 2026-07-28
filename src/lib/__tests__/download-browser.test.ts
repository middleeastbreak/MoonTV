import { triggerDownload } from '@/lib/m3u8-downloader';

describe('browser download handoff', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
    });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn(() => 'blob:download'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: jest.fn(),
    });
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('does not revoke an iPad Safari object URL while the save sheet may still use it', () => {
    triggerDownload(new Blob(['video']), 'episode', 'TS');

    jest.advanceTimersByTime(1_000);

    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it('also protects iPad Safari when it requests a desktop-class user agent', () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
    });

    triggerDownload(new Blob(['video']), 'episode', 'TS');
    jest.advanceTimersByTime(1_000);

    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });
});
