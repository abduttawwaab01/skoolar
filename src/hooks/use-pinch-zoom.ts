'use client';

import { useRef, useCallback, useState } from 'react';

interface PinchZoomOptions {
  enabled: boolean;
  minScale?: number;
  maxScale?: number;
}

export function usePinchZoom(options: PinchZoomOptions) {
  const { enabled, minScale = 0.3, maxScale = 3 } = options;
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const stateRef = useRef({
    initialPinchDistance: 0,
    initialScale: 1,
    currentScale: 1,
    isPinching: false,
  });

  const getPinchDistance = useCallback((touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  const getMidpoint = useCallback((touches: React.TouchList) => {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  }, []);

  const applyScale = useCallback((newScale: number) => {
    const s = Math.max(minScale, Math.min(maxScale, newScale));
    stateRef.current.currentScale = s;
    const el = containerRef.current?.firstElementChild as HTMLElement | null;
    if (el) {
      el.style.transform = `scale(${s})`;
      el.style.transformOrigin = 'top left';
      el.style.transition = 'none';
    }
    setZoomLevel(s);
  }, [minScale, maxScale]);

  const resetZoom = useCallback(() => {
    stateRef.current.currentScale = 1;
    const el = containerRef.current?.firstElementChild as HTMLElement | null;
    if (el) {
      el.style.transform = ''; // eslint-disable-line react-hooks/immutability
      el.style.transformOrigin = '';
    }
    setZoomLevel(1);
  }, []);

  const handlers = {
    onTouchStart: (e: React.TouchEvent) => {
      if (!enabled || e.touches.length < 2) return;
      const s = stateRef.current;
      s.initialPinchDistance = getPinchDistance(e.touches);
      s.initialScale = s.currentScale;
      s.isPinching = true;
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (!enabled || !stateRef.current.isPinching || e.touches.length < 2) return;
      e.preventDefault();
      const s = stateRef.current;
      const currentDistance = getPinchDistance(e.touches);
      const scaleDelta = currentDistance / s.initialPinchDistance;
      applyScale(s.initialScale * scaleDelta);
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (e.touches.length < 2) {
        stateRef.current.isPinching = false;
      }
    },
  };

  return { containerRef, zoomLevel, handlers, resetZoom, applyScale };
}
