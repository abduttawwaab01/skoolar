'use client';

import { useState } from 'react';
import { useMathDrillStore } from '@/store/math-drill-store';
import { MathDrillConfigurator } from './math-drill-configurator';
import { MathDrillPreview } from './math-drill-preview';

export function MathDrillManager() {
  const { savedConfigs, loadConfig, deleteSavedConfig, regenerateProblems, problems } = useMathDrillStore();
  const [activeTab, setActiveTab] = useState<'configurator' | 'preview'>('configurator');
  const [showSaved, setShowSaved] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card">
        <h2 className="text-sm font-semibold">Math Fact Drills</h2>
        <div className="flex items-center gap-2">
          <button onClick={regenerateProblems} className="btn-ghost text-xs">
            🔄 New Problems
          </button>
          {savedConfigs.length > 0 && (
            <div className="relative">
              <button onClick={() => setShowSaved(!showSaved)} className="btn-ghost text-xs">
                Saved ({savedConfigs.length})
              </button>
              {showSaved && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-popover border rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                  <div className="p-2 text-xs font-medium text-muted-foreground border-b">Saved Drills</div>
                  {savedConfigs.map((cfg, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 cursor-pointer text-sm"
                      onClick={() => { loadConfig(cfg); setShowSaved(false); }}
                    >
                      <span className="truncate">{cfg.sheetTitle}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteSavedConfig(cfg.sheetTitle); }}
                        className="text-xs text-red-400 hover:text-red-600 ml-2 shrink-0"
                      >
                        Del
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <button onClick={() => useMathDrillStore.getState().resetConfig()} className="btn-ghost text-xs text-red-500">
            Reset
          </button>
        </div>
      </div>

      <div className="flex gap-1 px-3 py-1.5 border-b bg-muted/10">
        {(['configurator', 'preview'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              activeTab === tab
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted/50'
            }`}
          >
            {tab === 'configurator' && '⚙️ Configurator'}
            {tab === 'preview' && '👁️ Preview'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'configurator' && <MathDrillConfigurator />}
        {activeTab === 'preview' && <MathDrillPreview />}
      </div>

      <div className="px-3 py-1 border-t text-[10px] text-muted-foreground bg-muted/10">
        {problems.length} problems ready
      </div>
    </div>
  );
}
