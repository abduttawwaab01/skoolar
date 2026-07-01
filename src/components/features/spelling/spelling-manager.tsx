'use client';

import { useState } from 'react';
import { useSpellingStore } from '@/store/spelling-store';
import { SpellingConfigurator } from './spelling-configurator';
import { SpellingPreview } from './spelling-preview';

export function SpellingManager() {
  const { savedConfigs, loadConfig, deleteSavedConfig } = useSpellingStore();
  const [activeTab, setActiveTab] = useState<'configurator' | 'preview'>('configurator');
  const [showSaved, setShowSaved] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card">
        <h2 className="text-sm font-semibold">Spelling & Vocabulary</h2>
        <div className="flex items-center gap-2">
          {savedConfigs.length > 0 && (
            <div className="relative">
              <button onClick={() => setShowSaved(!showSaved)} className="btn-ghost text-xs">
                Saved ({savedConfigs.length})
              </button>
              {showSaved && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-popover border rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                  <div className="p-2 text-xs font-medium text-muted-foreground border-b">Saved Sheets</div>
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
          <button onClick={() => useSpellingStore.getState().resetConfig()} className="btn-ghost text-xs text-red-500">
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
        {activeTab === 'configurator' && <SpellingConfigurator />}
        {activeTab === 'preview' && <SpellingPreview />}
      </div>
    </div>
  );
}
