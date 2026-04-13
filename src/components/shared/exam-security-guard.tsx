'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Shield, AlertTriangle, Monitor, Eye, X, Lock, Maximize, Minimize, Keyboard, Copy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExamSecuritySettings {
  fullscreen?: boolean;
  tabSwitchWarning?: boolean;
  tabSwitchAutoSubmit?: boolean;
  blockCopyPaste?: boolean;
  blockRightClick?: boolean;
  blockKeyboardShortcuts?: boolean;
  maxTabSwitches?: number;
  webcamMonitor?: boolean;
}

interface ExamSecurityGuardProps {
  settings: ExamSecuritySettings;
  enabled: boolean;
  onTabSwitch?: (count: number) => void;
  onAutoSubmit?: () => void;
  onSecurityViolation?: (type: string, details: Record<string, unknown>) => void;
  children: React.ReactNode;
}

interface ViolationRecord {
  type: string;
  timestamp: Date;
  details: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Keyboard shortcuts to block when `blockKeyboardShortcuts` is enabled. */
const BLOCKED_KEY_COMBOS: { key: string; ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean }[] = [
  // Copy / Paste / Cut
  { key: 'c', ctrl: true },
  { key: 'v', ctrl: true },
  { key: 'x', ctrl: true },
  { key: 'a', ctrl: true },
  // View source
  { key: 'u', ctrl: true },
  // Dev tools
  { key: 'I', ctrl: true, shift: true },
  { key: 'i', ctrl: true, shift: true },
  { key: 'J', ctrl: true, shift: true },
  { key: 'j', ctrl: true, shift: true },
  { key: 'C', ctrl: true, shift: true },
  { key: 'c', ctrl: true, shift: true },
  // F12
  { key: 'F12' },
  // Save
  { key: 's', ctrl: true },
  // Print
  { key: 'p', ctrl: true },
  // Select all
  { key: 'a', ctrl: true },
  // Refresh – optional (often too aggressive)
  // { key: 'r', ctrl: true },
  // { key: 'F5' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function matchesKeyCombo(e: KeyboardEvent, combo: (typeof BLOCKED_KEY_COMBOS)[number]): boolean {
  const ctrlMatch = combo.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
  const shiftMatch = combo.shift ? e.shiftKey : !e.shiftKey;
  const altMatch = combo.alt ? e.altKey : !e.altKey;
  const metaMatch = combo.meta ? e.metaKey : !e.metaKey;
  const keyMatch = e.key === combo.key || e.code === combo.key;
  return ctrlMatch && shiftMatch && altMatch && metaMatch && keyMatch;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Floating security badge rendered in the top-right corner. */
function SecurityBadge({ webcamMonitor }: { webcamMonitor: boolean }) {
  return (
    <div className="fixed top-3 right-3 z-[9999] flex items-center gap-2">
      <Badge
        variant="outline"
        className="bg-emerald-50 border-emerald-300 text-emerald-700 px-3 py-1.5 text-xs font-semibold shadow-sm flex items-center gap-1.5 backdrop-blur-sm"
      >
        <Lock className="h-3 w-3" />
        Security Active
      </Badge>
      {webcamMonitor && (
        <Badge
          variant="outline"
          className="bg-blue-50 border-blue-300 text-blue-700 px-3 py-1.5 text-xs font-semibold shadow-sm flex items-center gap-1.5 backdrop-blur-sm animate-pulse"
        >
          <Monitor className="h-3 w-3" />
          Webcam Monitoring
        </Badge>
      )}
    </div>
  );
}

/** Warning banner shown when a tab switch is detected. */
function TabSwitchWarning({
  count,
  maxTabSwitches,
  remaining,
  onDismiss,
}: {
  count: number;
  maxTabSwitches: number;
  remaining: number | null;
  onDismiss: () => void;
}) {
  const isCritical = maxTabSwitches > 0 && remaining !== null && remaining <= 1;
  const isWarning = maxTabSwitches > 0 && remaining !== null && remaining <= 2;

  return (
    <div
      className={`fixed top-14 left-1/2 -translate-x-1/2 z-[9998] max-w-md w-[calc(100%-2rem)] transition-all duration-300 animate-in slide-in-from-top-2 fade-in-0`}
    >
      <Card
        className={`border shadow-lg ${
          isCritical
            ? 'border-red-400 bg-red-50'
            : isWarning
              ? 'border-amber-400 bg-amber-50'
              : 'border-amber-300 bg-amber-50'
        }`}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div
              className={`flex-shrink-0 rounded-full p-2 ${
                isCritical ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className={`text-sm font-semibold ${isCritical ? 'text-red-800' : 'text-amber-800'}`}>
                {isCritical ? 'Final Warning!' : 'Tab Switch Detected'}
              </h4>
              <p className="text-xs mt-1 text-amber-700">
                Leaving the exam tab is not allowed. This incident has been recorded.
              </p>
              {remaining !== null && maxTabSwitches > 0 && (
                <p className={`text-xs mt-1.5 font-medium ${isCritical ? 'text-red-700' : 'text-amber-700'}`}>
                  {isCritical
                    ? 'Your exam will be auto-submitted if you switch tabs again!'
                    : `${remaining} tab switch${remaining !== 1 ? 'es' : ''} remaining before auto-submit.`}
                </p>
              )}
              <p className="text-[11px] mt-1 text-amber-600 opacity-70">
                Switch #{count}
              </p>
            </div>
            <button
              onClick={onDismiss}
              className="flex-shrink-0 rounded-full p-1 hover:bg-amber-200/60 transition-colors text-amber-500"
              aria-label="Dismiss warning"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Fullscreen exit overlay – shown briefly when user exits fullscreen unexpectedly. */
function FullscreenExitOverlay({ onGoFullscreen }: { onGoFullscreen: () => void }) {
  return (
    <div className="fixed inset-0 z-[9997] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="max-w-sm w-full border-amber-300 bg-white shadow-xl">
        <CardContent className="p-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <Maximize className="h-7 w-7" />
          </div>
          <h4 className="text-base font-semibold text-gray-900">Fullscreen Mode Required</h4>
          <p className="text-sm text-gray-600 mt-2">
            This exam requires fullscreen mode. Please return to fullscreen to continue.
          </p>
          <button
            onClick={onGoFullscreen}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Maximize className="h-4 w-4" />
            Return to Fullscreen
          </button>
        </CardContent>
      </Card>
    </div>
  );
}

/** Small violation log that can be expanded to show security events. */
function ViolationLog({
  violations,
  isOpen,
  onToggle,
}: {
  violations: ViolationRecord[];
  isOpen: boolean;
  onToggle: () => void;
}) {
  if (violations.length === 0) return null;

  return (
    <div className="fixed bottom-3 left-3 z-[9998]">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 shadow-sm hover:bg-gray-50 transition-colors"
      >
        <Eye className="h-3.5 w-3.5" />
        Security Log
        <Badge variant="destructive" className="ml-1 h-5 min-w-[20px] text-[10px] px-1.5">
          {violations.length}
        </Badge>
      </button>

      {isOpen && (
        <Card className="absolute bottom-12 left-0 w-80 max-h-64 overflow-hidden border shadow-lg">
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b px-3 py-2 bg-gray-50">
              <span className="text-xs font-semibold text-gray-700">Security Violations</span>
              <button
                onClick={onToggle}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close log"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {violations.map((v, i) => (
                <div key={i} className="flex items-start gap-2 px-3 py-2 border-b last:border-b-0">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-800 capitalize">{v.type.replace(/_/g, ' ')}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">{v.details}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{formatTime(v.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ExamSecurityGuard({
  settings,
  enabled,
  onTabSwitch,
  onAutoSubmit,
  onSecurityViolation,
  children,
}: ExamSecurityGuardProps) {
  // -- State ----------------------------------------------------------------
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showTabWarning, setShowTabWarning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenExit, setShowFullscreenExit] = useState(false);
  const [violationLog, setViolationLog] = useState<ViolationRecord[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [isSecurityActive, setIsSecurityActive] = useState(false);

  const autoSubmittedRef = useRef(false);
  const tabWarningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // -- Derived values -------------------------------------------------------
  const maxTab = settings.maxTabSwitches ?? 0; // 0 = unlimited
  const remaining =
    maxTab > 0 ? Math.max(0, maxTab - tabSwitchCount) : null;

  // -- Helpers --------------------------------------------------------------
  const addViolation = useCallback(
    (type: string, details: string) => {
      setViolationLog((prev) => [...prev, { type, timestamp: new Date(), details }]);
      onSecurityViolation?.(type, {
        timestamp: new Date().toISOString(),
        tabSwitchCount,
        message: details,
      });
    },
    [onSecurityViolation, tabSwitchCount],
  );

  const dismissTabWarning = useCallback(() => {
    setShowTabWarning(false);
    if (tabWarningTimerRef.current) {
      clearTimeout(tabWarningTimerRef.current);
      tabWarningTimerRef.current = null;
    }
  }, []);

  // -- Fullscreen -----------------------------------------------------------
  const requestFullscreen = useCallback(async () => {
    try {
      const el = containerRef.current ?? document.documentElement;
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if ((el as any).webkitRequestFullscreen) {
        await (el as any).webkitRequestFullscreen();
      } else if ((el as any).mozRequestFullScreen) {
        await (el as any).mozRequestFullScreen();
      } else if ((el as any).msRequestFullscreen) {
        await (el as any).msRequestFullscreen();
      }
    } catch {
      // Silently fail — some browsers may block programmatic fullscreen
    }
  }, []);

  const handleFullscreenChange = useCallback(() => {
    const fsElement =
      document.fullscreenElement ??
      (document as any).webkitFullscreenElement ??
      (document as any).mozFullScreenElement;
    const inFs = !!fsElement;
    setIsFullscreen(inFs);

    if (enabled && settings.fullscreen && !inFs && isSecurityActive) {
      setShowFullscreenExit(true);
      addViolation('fullscreen_exit', 'User exited fullscreen mode');
    } else {
      setShowFullscreenExit(false);
    }
  }, [enabled, settings.fullscreen, isSecurityActive, addViolation]);

  // -- Visibility change (tab switch) ---------------------------------------
  const handleVisibilityChange = useCallback(() => {
    if (!enabled || !isSecurityActive) return;
    if (document.visibilityState !== 'hidden') return;

    setTabSwitchCount((prev) => {
      const newCount = prev + 1;
      onTabSwitch?.(newCount);
      addViolation('tab_switch', `Tab switched (count: ${newCount})`);

      // Show warning
      setShowTabWarning(true);
      if (tabWarningTimerRef.current) {
        clearTimeout(tabWarningTimerRef.current);
      }
      tabWarningTimerRef.current = setTimeout(() => setShowTabWarning(false), 8000);

      // Check auto-submit
      if (
        settings.tabSwitchAutoSubmit &&
        maxTab > 0 &&
        newCount > maxTab &&
        !autoSubmittedRef.current
      ) {
        autoSubmittedRef.current = true;
        // Small delay so warning is visible
        setTimeout(() => {
          onAutoSubmit?.();
          addViolation('auto_submitted', `Exam auto-submitted after ${newCount} tab switches`);
        }, 1500);
      }

      return newCount;
    });
  }, [enabled, isSecurityActive, onTabSwitch, addViolation, settings.tabSwitchAutoSubmit, maxTab, onAutoSubmit]);

  // -- Block copy / paste / cut ----------------------------------------------
  const handleCopyPasteBlock = useCallback(
    (e: ClipboardEvent) => {
      if (!enabled || !isSecurityActive) return;
      e.preventDefault();
      e.stopPropagation();
      addViolation(
        'clipboard_blocked',
        `${e.type} event blocked`,
      );
    },
    [enabled, isSecurityActive, addViolation],
  );

  // -- Block right-click -----------------------------------------------------
  const handleContextMenu = useCallback(
    (e: MouseEvent) => {
      if (!enabled || !isSecurityActive) return;
      if (settings.blockRightClick) {
        e.preventDefault();
        e.stopPropagation();
        addViolation('right_click_blocked', 'Right-click context menu blocked');
      }
    },
    [enabled, isSecurityActive, settings.blockRightClick, addViolation],
  );

  // -- Block keyboard shortcuts -----------------------------------------------
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled || !isSecurityActive) return;
      if (!settings.blockKeyboardShortcuts && !settings.blockCopyPaste) return;

      const comboMatch = BLOCKED_KEY_COMBOS.some((combo) => matchesKeyCombo(e, combo));

      if (comboMatch && settings.blockKeyboardShortcuts) {
        e.preventDefault();
        e.stopPropagation();
        addViolation('keyboard_shortcut_blocked', `Blocked: ${e.key}${e.ctrlKey ? '+Ctrl' : ''}${e.shiftKey ? '+Shift' : ''}${e.altKey ? '+Alt' : ''}`);
        return;
      }

      // Extra copy/paste/cut blocking via keyboard (even if blockKeyboardShortcuts is off)
      if (settings.blockCopyPaste) {
        const copyPasteKeys = ['c', 'v', 'x', 'a'];
        if ((e.ctrlKey || e.metaKey) && copyPasteKeys.includes(e.key.toLowerCase())) {
          e.preventDefault();
          e.stopPropagation();
          addViolation('clipboard_blocked', `Keyboard ${e.type} blocked (${e.key})`);
        }
      }
    },
    [enabled, isSecurityActive, settings.blockKeyboardShortcuts, settings.blockCopyPaste, addViolation],
  );

  // -- Effects ---------------------------------------------------------------

  // Activate security once mounted — small delay avoids race conditions on initial render
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsSecurityActive(enabled);
    }, enabled ? 100 : 0);
    return () => clearTimeout(timer);
  }, [enabled]);

  // Fullscreen: enter on mount, listen for changes
  useEffect(() => {
    if (!enabled || !settings.fullscreen || !isSecurityActive) return;

    // Attempt to enter fullscreen
    requestFullscreen();

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
    };
  }, [enabled, settings.fullscreen, isSecurityActive, requestFullscreen, handleFullscreenChange]);

  // Tab switch detection
  useEffect(() => {
    if (!enabled || !settings.tabSwitchWarning || !isSecurityActive) return;

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, settings.tabSwitchWarning, isSecurityActive, handleVisibilityChange]);

  // Block copy/paste/cut (clipboard events)
  useEffect(() => {
    if (!enabled || !settings.blockCopyPaste || !isSecurityActive) return;

    document.addEventListener('copy', handleCopyPasteBlock);
    document.addEventListener('paste', handleCopyPasteBlock);
    document.addEventListener('cut', handleCopyPasteBlock);

    return () => {
      document.removeEventListener('copy', handleCopyPasteBlock);
      document.removeEventListener('paste', handleCopyPasteBlock);
      document.removeEventListener('cut', handleCopyPasteBlock);
    };
  }, [enabled, settings.blockCopyPaste, isSecurityActive, handleCopyPasteBlock]);

  // Block right-click
  useEffect(() => {
    if (!enabled || !isSecurityActive) return;

    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [enabled, isSecurityActive, handleContextMenu]);

  // Block keyboard shortcuts
  useEffect(() => {
    if (!enabled || !isSecurityActive) return;
    if (!settings.blockKeyboardShortcuts && !settings.blockCopyPaste) return;

    document.addEventListener('keydown', handleKeyDown, true); // capture phase

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [enabled, isSecurityActive, settings.blockKeyboardShortcuts, settings.blockCopyPaste, handleKeyDown]);

  // Cleanup tab warning timer
  useEffect(() => {
    return () => {
      if (tabWarningTimerRef.current) {
        clearTimeout(tabWarningTimerRef.current);
      }
    };
  }, []);

  // -- Render ----------------------------------------------------------------
  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <div ref={containerRef} className="relative" suppressHydrationWarning>
      {/* Security Badge */}
      <SecurityBadge webcamMonitor={!!settings.webcamMonitor} />

      {/* Tab Switch Warning Banner */}
      {showTabWarning && (
        <TabSwitchWarning
          count={tabSwitchCount}
          maxTabSwitches={maxTab}
          remaining={remaining}
          onDismiss={dismissTabWarning}
        />
      )}

      {/* Fullscreen Exit Overlay */}
      {showFullscreenExit && (
        <FullscreenExitOverlay onGoFullscreen={requestFullscreen} />
      )}

      {/* Violation Log */}
      <ViolationLog
        violations={violationLog}
        isOpen={showLog}
        onToggle={() => setShowLog((prev) => !prev)}
      />

      {/* Exam Content */}
      <div
        className="select-none"
        style={settings.blockCopyPaste ? { userSelect: 'none' } : undefined}
        onCopy={
          settings.blockCopyPaste
            ? (e) => {
                e.preventDefault();
                addViolation('copy_blocked', 'Copy event blocked via React');
              }
            : undefined
        }
        onPaste={
          settings.blockCopyPaste
            ? (e) => {
                e.preventDefault();
                addViolation('paste_blocked', 'Paste event blocked via React');
              }
            : undefined
        }
        onCut={
          settings.blockCopyPaste
            ? (e) => {
                e.preventDefault();
                addViolation('cut_blocked', 'Cut event blocked via React');
              }
            : undefined
        }
      >
        {children}
      </div>

      {/* Hidden feature indicators for parent to read via callbacks */}
      <div aria-hidden="true" className="sr-only">
        <span data-tab-switches={tabSwitchCount} />
        <span data-fullscreen={isFullscreen} />
        <span data-violations={violationLog.length} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Convenience hook: useExamSecurity
// ---------------------------------------------------------------------------

/**
 * A convenience hook that tracks exam security state for a parent component.
 * Returns the current tab switch count, fullscreen status, and total violations.
 *
 * Usage:
 * ```tsx
 * const { tabSwitches, isFullscreen, violations, reset } = useExamSecurity();
 * ```
 */
export function useExamSecurity() {
  const [tabSwitches, setTabSwitches] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [violations, setViolations] = useState(0);

  const handleTabSwitch = useCallback((count: number) => {
    setTabSwitches(count);
  }, []);

  const handleSecurityViolation = useCallback((_type: string, details: Record<string, unknown>) => {
    // We can't track individual violations from here easily,
    // but the parent can count callbacks
    setViolations((v) => v + 1);
  }, []);

  const handleAutoSubmit = useCallback(() => {
    // Parent should handle this
  }, []);

  const reset = useCallback(() => {
    setTabSwitches(0);
    setViolations(0);
  }, []);

  return {
    tabSwitches,
    isFullscreen,
    violations,
    handleTabSwitch,
    handleSecurityViolation,
    handleAutoSubmit,
    reset,
  };
}

export default ExamSecurityGuard;
