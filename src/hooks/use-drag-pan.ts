'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

interface DragPanOptions {
  enabled: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export function useDragPan(options: DragPanOptions) {
  const { enabled, onDragStart, onDragEnd } = options;
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const stateRef = useRef({
    isDown: false,
    startX: 0,
    startY: 0,
    translateX: 0,
    translateY: 0,
    lastTranslateX: 0,
    lastTranslateY: 0,
    pointerId: -1,
  });

  const getTransform = useCallback(() => {
    const s = stateRef.current;
    return `translate(${s.translateX}px, ${s.translateY}px)`;
  }, []);

  const reset = useCallback(() => {
    const s = stateRef.current;
    s.translateX = 0;
    s.translateY = 0;
    s.lastTranslateX = 0;
    s.lastTranslateY = 0;
    const el = containerRef.current?.firstElementChild as HTMLElement | null;
    if (el) el.style.transform = 'translate(0px, 0px)';
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    const onPointerDown = (e: PointerEvent) => {
      // Skip if target is an interactive element
      const target = e.target as HTMLElement;
      const tag = target.tagName.toLowerCase();
      if (
        tag === 'input' || tag === 'textarea' || tag === 'select' ||
        tag === 'button' || tag === 'a' ||
        target.isContentEditable ||
        target.closest('[role="button"],[role="combobox"],[role="listbox"],[role="option"]')
      ) return;
      const s = stateRef.current;
      s.isDown = true;
      s.startX = e.clientX - s.translateX;
      s.startY = e.clientY - s.translateY;
      s.pointerId = e.pointerId;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = 'grabbing';
      setIsDragging(true);
      onDragStart?.();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!stateRef.current.isDown) return;
      const s = stateRef.current;
      const dx = e.clientX - s.startX;
      const dy = e.clientY - s.startY;
      s.translateX = dx;
      s.translateY = dy;
      const child = el.firstElementChild as HTMLElement | null;
      if (child) {
        child.style.transform = `translate(${dx}px, ${dy}px)`;
        child.style.transition = 'none';
      }
    };

    const onPointerUp = () => {
      const s = stateRef.current;
      if (!s.isDown) return;
      s.isDown = false;
      s.lastTranslateX = s.translateX;
      s.lastTranslateY = s.translateY;
      el.releasePointerCapture(s.pointerId);
      el.style.cursor = 'grab';
      setIsDragging(false);
      onDragEnd?.();
    };

    el.style.cursor = 'grab';
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
    };
  }, [enabled, onDragStart, onDragEnd]);

  return { containerRef, isDragging, getTransform, reset };
}
