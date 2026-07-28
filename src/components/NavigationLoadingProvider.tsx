'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

interface NavigationLoadingContextType {
  isLoading: boolean;
  startLoading: () => void;
  stopLoading: () => void;
}

const NavigationLoadingContext = createContext<NavigationLoadingContextType>({
  isLoading: false,
  startLoading: () => {
    // Default implementation
  },
  stopLoading: () => {
    // Default implementation
  },
});

export const useNavigationLoading = () => useContext(NavigationLoadingContext);

function SearchParamsLoadingReset({ stopLoading }: { stopLoading: () => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const timer = window.setTimeout(stopLoading, 300);
    return () => window.clearTimeout(timer);
  }, [searchParams, stopLoading]);
  return null;
}

export function NavigationLoadingProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const pathname = usePathname();

  const startLoading = useCallback(() => {
    setIsLoading(true);
  }, []);

  const stopLoading = useCallback(() => {
    setIsLoading(false);
  }, []);

  // 监听路由变化，自动停止加载状态
  useEffect(() => {
    // 路由变化完成后，停止加载
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 300); // 给一个短暂延迟确保页面已经渲染

    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <NavigationLoadingContext.Provider value={{ isLoading, startLoading, stopLoading }}>
      <Suspense fallback={null}>
        <SearchParamsLoadingReset stopLoading={stopLoading} />
      </Suspense>
      {children}
    </NavigationLoadingContext.Provider>
  );
}
