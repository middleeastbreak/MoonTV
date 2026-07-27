export interface PlayerWithMedia {
  video?: HTMLVideoElement & {
    hls?: {
      stopLoad?(): void;
      detachMedia?(): void;
      destroy(): void;
    };
  };
  destroy(): void;
}

export function destroyPlayerMedia(player: PlayerWithMedia): unknown[] {
  const errors: unknown[] = [];
  const attempt = (action: () => void) => {
    try {
      action();
    } catch (error) {
      errors.push(error);
    }
  };

  const video = player.video;
  const hls = video?.hls;

  // Safari 可能在播放器 DOM 被销毁后继续播放底层媒体，必须先主动暂停。
  if (video) attempt(() => video.pause());

  if (hls?.stopLoad) attempt(() => hls.stopLoad?.());
  if (hls?.detachMedia) attempt(() => hls.detachMedia?.());
  if (hls) attempt(() => hls.destroy());

  if (video) {
    attempt(() => {
      video.removeAttribute('src');
      video.querySelectorAll('source').forEach((source) => source.remove());
      video.load();
    });
  }

  attempt(() => player.destroy());
  return errors;
}
