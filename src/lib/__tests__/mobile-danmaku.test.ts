import {
  DANMAKU_VISIBLE_KEY,
  initializeMobileDanmakuPolicy,
  isMobileBatteryDevice,
  MOBILE_DANMAKU_POLICY_KEY,
} from '@/lib/mobile-danmaku';

function storage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    values,
  };
}

describe('mobile danmaku policy', () => {
  it('detects iPad desktop mode without treating Windows touch laptops as mobile', () => {
    expect(
      isMobileBatteryDevice({ platform: 'MacIntel', maxTouchPoints: 5 })
    ).toBe(true);
    expect(
      isMobileBatteryDevice({
        platform: 'Win32',
        maxTouchPoints: 10,
        userAgent: 'Mozilla/5.0 Windows NT 10.0',
      })
    ).toBe(false);
  });

  it('disables existing automatic and visible settings once on mobile', () => {
    const target = storage({
      autoDanmakuEnabled: 'true',
      [DANMAKU_VISIBLE_KEY]: 'true',
    });
    const policy = initializeMobileDanmakuPolicy(target, {
      userAgent: 'Mozilla/5.0 iPhone Mobile',
    });
    expect(policy.autoEnabled).toBe(false);
    expect(policy.visible).toBe(false);
    expect(target.values.get(MOBILE_DANMAKU_POLICY_KEY)).toBe('1');
  });

  it('respects a later explicit mobile choice after migration', () => {
    const target = storage({
      [MOBILE_DANMAKU_POLICY_KEY]: '1',
      autoDanmakuEnabled: 'true',
      [DANMAKU_VISIBLE_KEY]: 'true',
    });
    const policy = initializeMobileDanmakuPolicy(target, {
      userAgent: 'Mozilla/5.0 Android Mobile',
    });
    expect(policy.autoEnabled).toBe(true);
    expect(policy.visible).toBe(true);
  });

  it('keeps desktop defaults enabled', () => {
    const policy = initializeMobileDanmakuPolicy(storage(), {
      userAgent: 'Mozilla/5.0 X11 Linux x86_64',
    });
    expect(policy.autoEnabled).toBe(true);
    expect(policy.visible).toBe(true);
  });
});
