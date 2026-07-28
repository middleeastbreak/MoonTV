export const MOBILE_DANMAKU_POLICY_KEY = 'moontv_mobile_danmaku_policy_v1';
export const DANMAKU_VISIBLE_KEY = 'danmakuVisiblePreference';

interface NavigatorLike {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface MobileDanmakuPolicy {
  isMobileBatteryDevice: boolean;
  autoEnabled: boolean;
  visible: boolean;
  migrated: boolean;
}

function readBoolean(
  storage: StorageLike,
  key: string,
  fallback: boolean
): boolean {
  const value = storage.getItem(key);
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

export function isMobileBatteryDevice(navigatorLike: NavigatorLike): boolean {
  const userAgent = navigatorLike.userAgent || '';
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)) return true;
  return (
    navigatorLike.platform === 'MacIntel' &&
    (navigatorLike.maxTouchPoints || 0) > 1
  );
}

export function initializeMobileDanmakuPolicy(
  storage: StorageLike,
  navigatorLike: NavigatorLike
): MobileDanmakuPolicy {
  const mobile = isMobileBatteryDevice(navigatorLike);
  const migrated = storage.getItem(MOBILE_DANMAKU_POLICY_KEY) === '1';

  if (mobile && !migrated) {
    storage.setItem(MOBILE_DANMAKU_POLICY_KEY, '1');
    storage.setItem('autoDanmakuEnabled', 'false');
    storage.setItem(DANMAKU_VISIBLE_KEY, 'false');
    return {
      isMobileBatteryDevice: true,
      autoEnabled: false,
      visible: false,
      migrated: true,
    };
  }

  return {
    isMobileBatteryDevice: mobile,
    autoEnabled: readBoolean(storage, 'autoDanmakuEnabled', !mobile),
    visible: readBoolean(storage, DANMAKU_VISIBLE_KEY, !mobile),
    migrated,
  };
}
