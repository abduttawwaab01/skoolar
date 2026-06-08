'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useResponsiveOverflow } from '@/hooks/use-responsive-overflow';
import { useDragPan } from '@/hooks/use-drag-pan';
import { usePinchZoom } from '@/hooks/use-pinch-zoom';
import { cn } from '@/lib/utils';
import './responsive-canvas.css';

type CanvasMode = 'scroll' | 'pan' | 'fit';

const STORAGE_KEY_PREFIX = 'rc-mode-';

function getStoredMode(viewId?: string): CanvasMode | null {
  if (!viewId) return null;
  try {
    const v = localStorage.getItem(`${STORAGE_KEY_PREFIX}${viewId}`);
    if (v === 'scroll' || v === 'pan' || v === 'fit') return v;
  } catch {}
  return null;
}

function storeMode(viewId: string | undefined, mode: CanvasMode) {
  if (!viewId) return;
  try { localStorage.setItem(`${STORAGE_KEY_PREFIX}${viewId}`, mode); } catch {}
}

export function ResponsiveCanvas({
  children,
  viewId,
  className,
}: {
  children: React.ReactNode;
  viewId?: string;
  className?: string;
}) {
  const isMobile = useIsMobile();
  const overflow = useResponsiveOverflow<HTMLDivElement>();
  const [mode, setMode] = useState<CanvasMode>('scroll');
  const [fitted, setFitted] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Initialise mode from storage on mount
  useEffect(() => {
    if (viewId && !initialized) {
      const saved = getStoredMode(viewId);
      if (saved) setMode(saved);
      setInitialized(true);
    }
  }, [viewId, initialized]);

  const changeMode = useCallback((newMode: CanvasMode) => {
    setMode(newMode);
    if (newMode !== 'fit') setFitted(false);
    storeMode(viewId, newMode);
  }, [viewId]);

  const pan = useDragPan({ enabled: isMobile && mode === 'pan' });
  const zoom = usePinchZoom({ enabled: isMobile && mode === 'fit' });

  const showToolbar = isMobile && overflow.isOverflowing;

  // Reset to scroll when leaving mobile
  useEffect(() => {
    if (!isMobile && initialized) {
      changeMode('scroll');
    }
  }, [isMobile, initialized, changeMode]);

  // Combined ref merger
  const mergedRef = useCallback((el: HTMLDivElement | null) => {
    (overflow.ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
    (pan.containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    (zoom.containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
  }, [overflow.ref, pan.containerRef, zoom.containerRef]);

  const toolbar = showToolbar && (
    <div className="rc-toolbar">
      <button
        type="button"
        className={cn('rc-toolbar-btn', mode === 'scroll' && 'rc-active')}
        onClick={() => changeMode('scroll')}
        aria-label="Scroll mode"
        title="Scroll horizontally"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="rc-icon" width="18" height="18">
          <path d="M8 3l-5 5 5 5" /><path d="M16 3l5 5-5 5" />
        </svg>
      </button>
      <button
        type="button"
        className={cn('rc-toolbar-btn', mode === 'pan' && 'rc-active')}
        onClick={() => changeMode('pan')}
        aria-label="Pan mode"
        title="Drag to pan"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="rc-icon" width="18" height="18">
          <circle cx="12" cy="12" r="2.5" />
          <path d="M5 12h3M16 12h3M12 5v3M12 16v3" />
        </svg>
      </button>
      <button
        type="button"
        className={cn('rc-toolbar-btn', mode === 'fit' && 'rc-active')}
        onClick={() => {
          if (mode === 'fit') {
            zoom.resetZoom();
            changeMode('scroll');
          } else {
            changeMode('fit');
            setFitted(true);
          }
        }}
        aria-label={mode === 'fit' ? 'Exit fit mode' : 'Fit to screen'}
        title={mode === 'fit' ? 'Exit fit view' : 'Fit to screen'}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="rc-icon" width="18" height="18">
          {mode === 'fit' ? (
            <><path d="M8 3H5a2 2 0 00-2 2v3" /><path d="M21 8V5a2 2 0 00-2-2h-3" /><path d="M16 21h3a2 2 0 002-2v-3" /><path d="M3 16v3a2 2 0 002 2h3" /></>
          ) : (
            <><path d="M8 3v3a2 2 0 01-2 2H3" /><path d="M21 8h-3a2 2 0 01-2-2V3" /><path d="M3 16h3a2 2 0 012 2v3" /><path d="M16 21v-3a2 2 0 012-2h3" /></>
          )}
        </svg>
      </button>
      {mode === 'fit' && (
        <span className="rc-zoom-level">{Math.round(overflow.scale * 100)}%</span>
      )}
    </div>
  );

  // Desktop: render children directly (parent ScrollArea handles scrolling)
  if (!isMobile) {
    return <>{children}</>;
  }

  // Scroll mode (default on mobile): minimal wrapper for overflow detection + toolbar.
  // No overflow:auto or overscroll-behavior — parent ScrollArea handles vertical scrolling.
  if (mode === 'scroll') {
    return (
      <div ref={overflow.ref} className="min-w-0">
        {children}
        {toolbar}
      </div>
    );
  }

  // Pan / Fit mode: interpose canvas with touch-action blocking
  return (
    <div className="responsive-canvas-wrapper min-w-0">
      <div
        ref={mergedRef}
        className={cn(
          'responsive-canvas-content min-w-0',
          mode === 'pan' && 'rc-pan',
          mode === 'fit' && 'rc-fit',
          pan.isDragging && 'rc-grabbing',
          className,
        )}
        style={
          mode === 'fit' && fitted
            ? { transform: `scale(${overflow.scale})`, transformOrigin: 'top left', width: `${overflow.contentWidth}px` }
            : mode === 'fit' && !fitted
              ? { width: 'max-content' }
              : undefined
        }
        {...zoom.handlers}
      >
        {children}
      </div>
      {toolbar}
    </div>
  );
}
