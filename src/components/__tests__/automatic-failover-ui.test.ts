import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('automatic failover setting', () => {
  const userMenuSource = readSource('src/components/UserMenu.tsx');

  it('shows the opt-in setting with its risk and attempt limit', () => {
    expect(userMenuSource).toContain('弱网络环境下自动切换播放源');
    expect(userMenuSource).toMatch(/默认关闭，每次播放最多尝试 2\s+个备用源/);
    expect(userMenuSource).toContain('仍可能匹配失败或识别有误');
  });
});
