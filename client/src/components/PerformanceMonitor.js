import React, { useEffect, useState } from 'react';
import { getCLS, getFCP, getFID, getLCP, getTTFB } from 'web-vitals';

const PerformanceMonitor = () => {
  const [metrics, setMetrics] = useState({});

  useEffect(() => {
    // Only run in development
    if (process.env.NODE_ENV !== 'development') return;

    const updateMetric = (metric) => {
      setMetrics(prev => ({
        ...prev,
        [metric.name]: {
          value: metric.value,
          rating: metric.rating,
          delta: metric.delta
        }
      }));
    };

    // Collect Web Vitals
    getCLS(updateMetric);
    getFID(updateMetric); // Using FID as INP is not available in this version
    getFCP(updateMetric);
    getLCP(updateMetric);
    getTTFB(updateMetric);

    // Monitor memory usage
    const monitorMemory = () => {
      if ('memory' in performance) {
        setMetrics(prev => ({
          ...prev,
          memory: {
            used: Math.round(performance.memory.usedJSHeapSize / 1048576),
            total: Math.round(performance.memory.totalJSHeapSize / 1048576),
            limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576)
          }
        }));
      }
    };

    const memoryInterval = setInterval(monitorMemory, 5000);
    monitorMemory(); // Initial call

    return () => {
      clearInterval(memoryInterval);
    };
  }, []);

  // Only render in development
  if (process.env.NODE_ENV !== 'development') return null;

  const getRatingColor = (rating) => {
    switch (rating) {
      case 'good': return 'text-green-600';
      case 'needs-improvement': return 'text-yellow-600';
      case 'poor': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm z-50">
      <h3 className="text-sm font-semibold text-gray-900 mb-2">Performance Metrics</h3>
      
      <div className="space-y-2 text-xs">
        {Object.entries(metrics).map(([name, data]) => {
          if (name === 'memory') {
            return (
              <div key={name} className="flex justify-between">
                <span className="text-gray-600">Memory:</span>
                <span className="text-gray-900">
                  {data.used}MB / {data.total}MB
                </span>
              </div>
            );
          }
          
          return (
            <div key={name} className="flex justify-between">
              <span className="text-gray-600">{name.toUpperCase()}:</span>
              <span className={getRatingColor(data.rating)}>
                {Math.round(data.value)}ms ({data.rating})
              </span>
            </div>
          );
        })}
      </div>
      
      <div className="mt-2 pt-2 border-t border-gray-200">
        <div className="text-xs text-gray-500">
          Dev Mode Only
        </div>
      </div>
    </div>
  );
};

export default PerformanceMonitor;