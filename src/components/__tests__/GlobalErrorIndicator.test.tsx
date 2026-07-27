import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

import {
  GlobalErrorIndicator,
  triggerGlobalError,
} from '@/components/GlobalErrorIndicator';

describe('GlobalErrorIndicator', () => {
  let container: HTMLDivElement;
  let root: Root;
  const actEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  };

  beforeAll(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
  });

  beforeEach(() => {
    jest.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<GlobalErrorIndicator />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.useRealTimers();
  });

  it('automatically closes a temporary danmaku matching error', () => {
    act(() => {
      triggerGlobalError('自动加载弹幕失败，请手动选择弹幕源', 5000);
    });

    expect(container).toHaveTextContent('自动加载弹幕失败，请手动选择弹幕源');

    act(() => jest.advanceTimersByTime(4999));
    expect(container).toHaveTextContent('自动加载弹幕失败，请手动选择弹幕源');

    act(() => jest.advanceTimersByTime(1));
    expect(container).not.toHaveTextContent(
      '自动加载弹幕失败，请手动选择弹幕源'
    );
  });

  it('keeps ordinary errors visible until the user closes them', () => {
    act(() => triggerGlobalError('普通错误'));
    act(() => jest.advanceTimersByTime(30_000));

    expect(container).toHaveTextContent('普通错误');
  });
});
