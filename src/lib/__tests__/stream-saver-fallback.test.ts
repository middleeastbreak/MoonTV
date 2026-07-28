import { WritableStream as NodeWritableStream } from 'stream/web';

import { createFileSystemWriteStream } from '@/lib/stream-saver-fallback';

describe('file-system streaming downloads', () => {
  beforeAll(() => {
    Object.assign(globalThis, { WritableStream: NodeWritableStream });
  });

  it('reuses a selected season directory without opening a file picker', async () => {
    const close = jest.fn();
    const writable = { write: jest.fn(), close, abort: jest.fn() };
    const getFileHandle = jest.fn().mockResolvedValue({
      createWritable: jest.fn().mockResolvedValue(writable),
    });
    const directory = { getFileHandle } as unknown as FileSystemDirectoryHandle;
    const showSaveFilePicker = jest.fn();
    Object.assign(window, { showSaveFilePicker });

    const stream = await createFileSystemWriteStream(
      '问心2_第1集.ts',
      undefined,
      directory
    );
    const writer = stream?.getWriter();
    await writer?.write(new Uint8Array([1]));
    await writer?.close();

    expect(getFileHandle).toHaveBeenCalledWith('问心2_第1集.ts', {
      create: true,
    });
    expect(showSaveFilePicker).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });
});
