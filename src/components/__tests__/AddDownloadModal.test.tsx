import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import AddDownloadModal from '@/components/AddDownloadModal';

const mockIsStreamSaverSupported = jest.fn(() => true);
const mockSupportsFileSystemAccess = jest.fn(() => true);
const mockSupportsDirectoryPicker = jest.fn(() => true);

jest.mock('@/lib/stream-saver', () => ({
  isStreamSaverSupported: mockIsStreamSaverSupported,
}));

jest.mock('@/lib/stream-saver-fallback', () => ({
  supportsFileSystemAccess: mockSupportsFileSystemAccess,
  supportsDirectoryPicker: mockSupportsDirectoryPicker,
}));

const episodes = [
  { url: 'episode-1.m3u8', title: '第一集' },
  { url: 'episode-2.m3u8', title: '第二集' },
];

function renderModal(onAddSeason = jest.fn()) {
  render(
    <AddDownloadModal
      isOpen
      onClose={jest.fn()}
      onAddTask={jest.fn()}
      onAddSeason={onAddSeason}
      seasonEpisodes={episodes}
    />
  );
  return onAddSeason;
}

describe('whole-season save destination', () => {
  beforeEach(() => {
    localStorage.clear();
    mockIsStreamSaverSupported.mockReturnValue(true);
    mockSupportsFileSystemAccess.mockReturnValue(true);
    mockSupportsDirectoryPicker.mockReturnValue(true);
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    jest.spyOn(window, 'alert').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Reflect.deleteProperty(window, 'showDirectoryPicker');
  });

  it('asks for one directory and uses direct writes for every desktop mode', async () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Windows NT 10.0) Chrome/126.0.0.0',
    });
    const directory = { name: 'MoonTV' } as FileSystemDirectoryHandle;
    const showDirectoryPicker = jest.fn().mockResolvedValue(directory);
    Object.assign(window, { showDirectoryPicker });
    const onAddSeason = renderModal();

    await waitFor(() => {
      const recommendedBadge = screen.getByText('推荐');
      expect(recommendedBadge).toHaveClass('text-[10px]', 'px-1.5', 'py-px');
      expect(recommendedBadge).not.toHaveClass('text-sm', 'px-2', 'py-0.5');
    });

    fireEvent.click(screen.getByText('一键下载整季（2 集）'));

    await waitFor(() => expect(showDirectoryPicker).toHaveBeenCalledTimes(1));
    expect(onAddSeason).toHaveBeenCalledWith(
      expect.objectContaining({
        streamMode: 'file-system',
        directoryHandle: directory,
      })
    );
  });

  it('does not start automatic multi-file saves on iPad', async () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
    });
    const onAddSeason = renderModal();

    fireEvent.click(screen.getByText('一键下载整季（2 集）'));

    await waitFor(() =>
      expect(window.alert).toHaveBeenCalledWith(
        expect.stringContaining('移动设备')
      )
    );
    expect(onAddSeason).not.toHaveBeenCalled();
  });

  it('blocks unsafe batch saves when no directory picker exists', async () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (X11; Linux x86_64) Firefox/128.0',
    });
    const onAddSeason = renderModal();

    fireEvent.click(screen.getByText('一键下载整季（2 集）'));

    await waitFor(() =>
      expect(window.alert).toHaveBeenCalledWith(
        expect.stringContaining('无法一次选择整季保存目录')
      )
    );
    expect(onAddSeason).not.toHaveBeenCalled();
  });

  it('falls back from a saved mode that the current device cannot use', async () => {
    localStorage.setItem('streamMode', 'file-system');
    mockIsStreamSaverSupported.mockReturnValue(false);
    mockSupportsFileSystemAccess.mockReturnValue(false);
    mockSupportsDirectoryPicker.mockReturnValue(false);
    renderModal();

    const ordinaryMode = screen.getByRole('radio', { name: /普通模式/ });
    await waitFor(() => expect(ordinaryMode).toBeChecked());
    expect(screen.getByRole('radio', { name: /文件系统直写/ })).toBeDisabled();
  });
});
