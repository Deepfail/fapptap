import { useEffect, useRef, useState } from "react";

interface VirtualizedGridProps<T> {
  items: T[];
  itemWidth: number;
  itemHeight: number;
  gap?: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
}

export function VirtualizedGrid<T>({
  items,
  itemWidth,
  itemHeight,
  gap = 8,
  renderItem,
  className = "",
}: VirtualizedGridProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ width, height });
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const visibleRowStart = Math.floor(scrollTop / (itemHeight + gap));
      const visibleRows =
        Math.ceil(containerSize.height / (itemHeight + gap)) + 2;
      const itemsPerRow = Math.max(
        1,
        Math.floor(containerSize.width / (itemWidth + gap))
      );

      setVisibleRange({
        start: visibleRowStart * itemsPerRow,
        end: (visibleRowStart + visibleRows) * itemsPerRow,
      });
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial calculation

    return () => container.removeEventListener("scroll", handleScroll);
  }, [containerSize, itemWidth, itemHeight, gap]);

  const itemsPerRow = Math.max(
    1,
    Math.floor(containerSize.width / (itemWidth + gap))
  );
  const totalRows = Math.ceil(items.length / itemsPerRow);
  const totalHeight = totalRows * (itemHeight + gap);

  const visibleItems = items.slice(
    Math.max(0, visibleRange.start),
    Math.min(items.length, visibleRange.end)
  );

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height: "100%" }}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        {visibleItems.map((item, index) => {
          const absoluteIndex = Math.max(0, visibleRange.start) + index;
          const row = Math.floor(absoluteIndex / itemsPerRow);
          const col = absoluteIndex % itemsPerRow;

          return (
            <div
              key={absoluteIndex}
              style={{
                position: "absolute",
                top: row * (itemHeight + gap),
                left: col * (itemWidth + gap),
                width: itemWidth,
                height: itemHeight,
              }}
            >
              {renderItem(item, absoluteIndex)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
