import React, { useState, useEffect, useMemo } from 'react';
import { cn } from '../../lib/utils';

export interface MasonryGridProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor?: (item: T) => string;
  className?: string;
}

export function MasonryGrid<T>({
  items,
  renderItem,
  keyExtractor,
  className,
}: MasonryGridProps<T>) {
  const [columns, setColumns] = useState<number>(() => {
    if (typeof window === 'undefined') return 3;
    if (window.innerWidth >= 1024) return 3;
    if (window.innerWidth >= 768) return 2;
    return 1;
  });

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      if (w >= 1024) {
        setColumns(3);
      } else if (w >= 768) {
        setColumns(2);
      } else {
        setColumns(1);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Distribute items across columns in left-to-right round-robin order
  const columnData = useMemo(() => {
    const cols: T[][] = Array.from({ length: columns }, () => []);
    items.forEach((item, index) => {
      cols[index % columns].push(item);
    });
    return cols;
  }, [items, columns]);

  return (
    <div className={cn('flex gap-4 items-start w-full', className)}>
      {columnData.map((colItems, colIdx) => (
        <div key={colIdx} className="flex-1 flex flex-col gap-4 min-w-0">
          {colItems.map((item, itemIdx) => {
            const key = keyExtractor ? keyExtractor(item) : (item as any)?.id || `${colIdx}-${itemIdx}`;
            return <React.Fragment key={key}>{renderItem(item, itemIdx)}</React.Fragment>;
          })}
        </div>
      ))}
    </div>
  );
}
