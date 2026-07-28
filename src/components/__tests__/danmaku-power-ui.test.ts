import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('mobile danmaku power notices', () => {
  const userMenuSource = readSource('src/components/UserMenu.tsx');
  const playPageSource = readSource('src/app/play/page.tsx');

  it('places the persistent warning below automatic matching settings', () => {
    const automaticSetting = userMenuSource.indexOf(
      '{/* 自动匹配弹幕 */}'
    );
    const warning = userMenuSource.indexOf(
      '自动匹配弹幕会增加耗电和设备发热'
    );
    const retrySetting = userMenuSource.indexOf(
      '{/* 弹幕自动尝试次数设置 */}'
    );

    expect(automaticSetting).toBeGreaterThan(-1);
    expect(warning).toBeGreaterThan(automaticSetting);
    expect(warning).toBeLessThan(retrySetting);
    expect(userMenuSource).not.toContain('setShowDanmakuPowerNotice');
  });

  it('shows a transient player notice after manual danmaku selection', () => {
    expect(playPageSource).toContain(
      "artPlayerRef.current.notice.show =\n                          '手动加载弹幕会增加耗电和设备发热'"
    );
  });
});
