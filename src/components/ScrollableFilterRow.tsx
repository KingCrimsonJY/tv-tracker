import React, { useCallback, useEffect, useRef, useState } from 'react';

interface ScrollableFilterRowProps {
  children: React.ReactNode;
  className?: string;
}

export const ScrollableFilterRow: React.FC<ScrollableFilterRowProps> = ({
  children,
  className = '',
}) => {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [fadeLeft, setFadeLeft] = useState(false);
  const [fadeRight, setFadeRight] = useState(false);

  const updateFade = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 2) {
      setFadeLeft(false);
      setFadeRight(false);
      return;
    }
    setFadeLeft(el.scrollLeft > 2);
    setFadeRight(el.scrollLeft < maxScroll - 2);
  }, []);

  useEffect(() => {
    updateFade();
    const el = scrollerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => updateFade());
    ro.observe(el);
    if (el.firstElementChild) {
      ro.observe(el.firstElementChild);
    }
    return () => ro.disconnect();
  }, [updateFade, children]);

  const maskClass =
    fadeLeft && fadeRight
      ? 'filter-scroll-fade-both'
      : fadeLeft
        ? 'filter-scroll-fade-left'
        : fadeRight
          ? 'filter-scroll-fade-right'
          : '';

  return (
    <div
      ref={scrollerRef}
      onScroll={updateFade}
      className={`max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${maskClass} ${className}`.trim()}
    >
      {children}
    </div>
  );
};
