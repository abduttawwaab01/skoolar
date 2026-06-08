'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  disabled?: boolean;
}

export function usePullToRefresh({ onRefresh, threshold = 80, disabled = false }: UsePullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: Event) => {
    if (disabled || refreshing) return;
    if (window.scrollY > 0) return;
    const te = e as TouchEvent;
    startY.current = te.touches[0].clientY;
    pulling.current = true;
  }, [disabled, refreshing]);

  const handleTouchMove = useCallback((e: Event) => {
    if (!pulling.current || refreshing || disabled) return;
    const te = e as TouchEvent;
    const currentY = te.touches[0].clientY;
    const diff = currentY - startY.current;
    if (diff > 0) {
      const dampened = Math.min(diff * 0.5, threshold * 1.5);
      setPullDistance(dampened);
    }
  }, [refreshing, disabled, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current || refreshing) return;
    pulling.current = false;
    if (pullDistance >= threshold) {
      setRefreshing(true);
      setPullDistance(0);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, threshold, refreshing, onRefresh]);

  useEffect(() => {
    if (disabled) return;
    const container = containerRef.current || document;
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, disabled]);

  const PullToRefreshIndicator = pullDistance > 0 || refreshing ? (
    <div
      className="pull-to-refresh-indicator"
      style={{
        height: refreshing ? 60 : Math.min(pullDistance, 60),
        opacity: refreshing ? 1 : Math.min(pullDistance / threshold, 1),
        overflow: 'hidden',
        transition: refreshing ? 'height 0.2s' : 'none',
      }}
    >
      {refreshing ? (
        <>
          <div className="spinner" />
          Refreshing...
        </>
      ) : pullDistance >= threshold ? (
        <>
          <div className="spinner" />
          Release to refresh
        </>
      ) : (
        <>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: `rotate(${pullDistance * 1.5}deg)`, transition: 'transform 0.1s' }}>
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          Pull to refresh
        </>
      )}
    </div>
  ) : null;

  return { pullDistance, refreshing, containerRef, PullToRefreshIndicator };
}
