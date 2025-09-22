import React, { useState, useRef, useMemo, memo } from 'react';

const VirtualScrollList = memo(({ 
  items, 
  itemHeight = 100, 
  containerHeight = 400, 
  renderItem, 
  overscan = 5,
  className = ''
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef();

  const visibleItems = useMemo(() => {
    const containerItemCount = Math.ceil(containerHeight / itemHeight);
    const totalItemCount = items.length;
    
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + containerItemCount + overscan,
      totalItemCount - 1
    );

    const visibleStartIndex = Math.max(0, startIndex - overscan);

    return {
      startIndex: visibleStartIndex,
      endIndex,
      offsetY: visibleStartIndex * itemHeight,
      items: items.slice(visibleStartIndex, endIndex + 1)
    };
  }, [items, itemHeight, containerHeight, scrollTop, overscan]);

  const handleScroll = (e) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const totalHeight = items.length * itemHeight;

  return (
    <div
      ref={scrollElementRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${visibleItems.offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          {visibleItems.items.map((item, index) => {
            const actualIndex = visibleItems.startIndex + index;
            return (
              <div
                key={item.id || actualIndex}
                style={{ height: itemHeight }}
              >
                {renderItem(item, actualIndex)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

VirtualScrollList.displayName = 'VirtualScrollList';

export default VirtualScrollList;