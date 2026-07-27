import fs from 'fs';
import path from 'path';

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function listTsxFiles(relativeDirectory: string): string[] {
  const directory = path.join(process.cwd(), relativeDirectory);
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : listTsxFiles(relativePath);
    }
    return entry.isFile() && entry.name.endsWith('.tsx') ? [relativePath] : [];
  });
}

function requireMatch(value: string | undefined, description: string) {
  if (!value) {
    throw new Error(`Unable to find ${description}`);
  }
  return value;
}

function getZIndex(classes: string, variant?: string) {
  const prefix = variant ? `${variant}:` : '';
  const arbitrary = classes.match(new RegExp(`${prefix}z-\\[(\\d+)\\]`));
  if (arbitrary) return Number(arbitrary[1]);

  const scale = classes.match(new RegExp(`${prefix}z-(\\d+)`));
  if (scale) return Number(scale[1]);

  throw new Error(`Missing ${prefix}z-index class in: ${classes}`);
}

describe('desktop navigation layering', () => {
  const topNavSource = readSource('src/components/TopNav.tsx');
  const videoCardSource = readSource('src/components/VideoCard.tsx');
  const playPageSource = readSource('src/app/play/page.tsx');

  const topNavClasses = requireMatch(
    topNavSource.match(/<header className='([^']*sticky top-0[^']*)'/)?.[1],
    'desktop top navigation classes'
  );
  const videoCardClasses = requireMatch(
    videoCardSource.match(/className="([^"]*hover:scale-\[1\.05\][^"]*)"/)?.[1],
    'video card hover classes'
  );
  const danmakuLoadingClasses = requireMatch(
    playPageSource.match(
      /className='([^']*absolute top-4 left-4 right-4[^']*)'/
    )?.[1],
    'automatic danmaku loading notice classes'
  );

  it('keeps a hovered first-row poster below the top navigation', () => {
    expect(getZIndex(topNavClasses)).toBeGreaterThan(
      getZIndex(videoCardClasses, 'hover')
    );
  });

  it('keeps the automatic danmaku loading notice below the top navigation', () => {
    expect(getZIndex(topNavClasses)).toBeGreaterThan(
      getZIndex(danmakuLoadingClasses)
    );
  });
});

describe('blocking overlay layering', () => {
  const topNavSource = readSource('src/components/TopNav.tsx');
  const mobileNavSource = readSource('src/components/MobileBottomNav.tsx');
  const navigationLoadingSource = readSource(
    'src/components/NavigationLoadingIndicator.tsx'
  );
  const homePageSource = readSource('src/app/page.tsx');
  const dataMigrationSource = readSource('src/components/DataMigration.tsx');

  const topNavClasses = requireMatch(
    topNavSource.match(/<header className='([^']*sticky top-0[^']*)'/)?.[1],
    'desktop top navigation classes'
  );
  const mobileNavClasses = requireMatch(
    mobileNavSource.match(
      /className='([^']*md:hidden fixed left-0 right-0[^']*)'/
    )?.[1],
    'mobile bottom navigation classes'
  );
  const blockingFloor = Math.max(
    getZIndex(topNavClasses),
    getZIndex(mobileNavClasses)
  );

  const overlays = [
    [
      'navigation loading overlay',
      requireMatch(
        navigationLoadingSource.match(
          /className='([^']*fixed inset-0[^']*)'/
        )?.[1],
        'navigation loading overlay classes'
      ),
    ],
    [
      'home announcement modal',
      requireMatch(
        homePageSource.match(
          /className=\{`([^`]*fixed inset-0 z-[^`]*)`\}/
        )?.[1],
        'home announcement modal classes'
      ),
    ],
    [
      'data migration modal',
      requireMatch(
        dataMigrationSource.match(
          /className=\{`([^`]*fixed inset-0[^`]*)`\}/
        )?.[1],
        'data migration modal classes'
      ),
    ],
  ] as const;

  it.each(overlays)(
    '%s stays above desktop and mobile navigation',
    (_, classes) => {
      expect(getZIndex(classes)).toBeGreaterThan(blockingFloor);
    }
  );

  it('keeps every full-screen fixed overlay above navigation', () => {
    const violations = ['src/app', 'src/components']
      .flatMap(listTsxFiles)
      .flatMap((relativePath) =>
        readSource(relativePath)
          .split('\n')
          .map((line, index) => ({ relativePath, line, lineNumber: index + 1 }))
      )
      .filter(({ line }) => line.includes('fixed inset-0'))
      .filter(({ line }) => {
        try {
          return getZIndex(line) <= blockingFloor;
        } catch {
          return true;
        }
      })
      .map(({ relativePath, lineNumber }) => `${relativePath}:${lineNumber}`);

    expect(violations).toEqual([]);
  });
});
