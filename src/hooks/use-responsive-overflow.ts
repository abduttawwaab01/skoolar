'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export function useResponsiveOverflow<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [contentWidth, setContentWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [scale, setScale] = useState(1);

  const check = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const cw = el.scrollWidth;
    const vw = el.clientWidth;
    const ow = cw > vw;
    setContentWidth(cw);
    setContainerWidth(vw);
    setIsOverflowing(ow);
    setScale(ow ? vw / cw : 1);
  }, []);

  useEffect(() => {
    check();
    const ro = new ResizeObserver(check);
    const el = ref.current;
    if (el) ro.observe(el);
    return () => ro.disconnect();
  }, [check]);

  return { ref, isOverflowing, contentWidth, containerWidth, scale, check };
}
