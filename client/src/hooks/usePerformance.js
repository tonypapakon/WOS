import { useMemo, useCallback, useRef, useEffect, useState } from 'react';

// Hook for debouncing values (useful for search inputs)
export const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Hook for throttling function calls
export const useThrottle = (callback, delay) => {
  const lastRun = useRef(Date.now());

  return useCallback((...args) => {
    if (Date.now() - lastRun.current >= delay) {
      callback(...args);
      lastRun.current = Date.now();
    }
  }, [callback, delay]);
};

// Hook for memoizing expensive calculations
export const useExpensiveCalculation = (calculation, dependencies) => {
  return useMemo(() => {
    const start = performance.now();
    const result = calculation();
    const end = performance.now();
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`Expensive calculation took ${end - start} milliseconds`);
    }
    
    return result;
  }, dependencies);
};

// Hook for intersection observer (useful for lazy loading)
export const useIntersectionObserver = (options = {}) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [entry, setEntry] = useState(null);
  const elementRef = useRef(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
      setEntry(entry);
    }, options);

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [options]);

  return [elementRef, isIntersecting, entry];
};

// Hook for measuring component render performance
export const useRenderPerformance = (componentName) => {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(Date.now());

  useEffect(() => {
    renderCount.current += 1;
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTime.current;
    lastRenderTime.current = now;

    if (process.env.NODE_ENV === 'development') {
      console.log(`${componentName} render #${renderCount.current}, time since last: ${timeSinceLastRender}ms`);
    }
  });

  return renderCount.current;
};

// Hook for optimized event handlers
export const useOptimizedEventHandler = (handler, dependencies = []) => {
  return useCallback(handler, dependencies);
};

// Hook for managing component state with performance tracking
export const usePerformantState = (initialState, stateName) => {
  const [state, setState] = useState(initialState);
  const updateCount = useRef(0);

  const optimizedSetState = useCallback((newState) => {
    updateCount.current += 1;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`${stateName} state update #${updateCount.current}`);
    }
    
    setState(newState);
  }, [stateName]);

  return [state, optimizedSetState];
};