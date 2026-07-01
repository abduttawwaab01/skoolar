'use client';

import { useState } from 'react';
import { useSpellingStore } from '@/store/spelling-store';
import {
  TEMPLATE_META,
  SPELLING_COLUMN_OPTIONS,
  parseWordList,
  type SpellingTemplateId,
} from '@/lib/spelling-utils';

const INNER_TABS = [
  { id: 'templates', label: 'Templates', icon: '🖼️' },
  { id: 'word-list', label: 'Word List', icon: '📝' },
  { id: 'layout', label: 'Layout', icon: '📐' },
  { id: 'content', label: 'Content', icon: '⚙️' },
  { id: 'colors', label: 'Colors', icon: '🎨' },
];

export function SpellingConfigurator() {
  const { config, setConfig } = useSpellingStore();
  const [innerTab, setInnerTab] = useState('templates');

  const handleTemplateSelect = (id: SpellingTemplateId) => {
    const { TEMPLATE_PRESETS } = require('@/lib/spelling-utils/templates');
    const preset = TEMPLATE_PRESETS[id];
    if (preset) setConfig(preset);
  };

  const wordCount = parseWordList(config.wordList).length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 p-2 bg-muted/30 rounded-t-lg border-b overflow-x-auto">
        {INNER_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setInnerTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              innerTab === t.id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted/50'
            }`}
          >
            <span className="text-base">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {innerTab === 'templates' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(Object.entries(TEMPLATE_META) as [SpellingTemplateId, typeof TEMPLATE_META[SpellingTemplateId]][]).map(([id, meta]) => (
              <button
                key={id}
                onClick={() => handleTemplateSelect(id)}
                className={`p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                  config.templateId === id
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="text-3xl mb-2">
                  {id === 'spelling-list' && '📋'}
                  {id === 'vocabulary-builder' && '📖'}
                  {id === 'dictation-sheet' && '🎧'}
                  {id === 'word-family' && '👨‍👩‍👧‍👦'}
                  {id === 'sentence-writing' && '✍️'}
                </div>
                <div className="font-semibold text-sm">{meta.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{meta.description}</div>
              </button>
            ))}
          </div>
        )}

        {innerTab === 'word-list' && (
          <div className="space-y-4">
            <Field label={`Word List (${wordCount} words)`}>
              <textarea
                value={config.wordList}
                onChange={(e) => setConfig({ wordList: e.target.value })}
                rows={10}
                className="input-field w-full font-mono text-sm"
                placeholder="Enter one word per line..."
              />
            </Field>

            <div className="text-xs text-muted-foreground">
              {wordCount === 0 && '⚠️ Enter at least one word'}
              {wordCount > 0 && `${wordCount} word${wordCount > 1 ? 's' : ''} entered`}
              {config.templateId === 'vocabulary-builder' && (
                <span className="block mt-1">Format: <code>word:definition</code></span>
              )}
              {config.templateId === 'word-family' && (
                <span className="block mt-1">Format: <code>word:family=-at</code> or <code>word-family</code></span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Number of Columns">
                <div className="flex gap-2">
                  {SPELLING_COLUMN_OPTIONS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setConfig({ numberOfColumns: c })}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        config.numberOfColumns === c ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                      }`}
                    >
                      {c} col{c > 1 ? 's' : ''}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Show Trace Lines">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={config.showTraceLines} onChange={(e) => setConfig({ showTraceLines: e.target.checked })} className="toggle" />
                  <span>{config.showTraceLines ? 'Yes' : 'No'}</span>
                </label>
              </Field>

              <Field label="Show Sentence Lines">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={config.showSentenceLines} onChange={(e) => setConfig({ showSentenceLines: e.target.checked })} className="toggle" />
                  <span>{config.showSentenceLines ? 'Yes' : 'No'}</span>
                </label>
              </Field>

              <Field label="Show Definitions">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={config.showDefinitions} onChange={(e) => setConfig({ showDefinitions: e.target.checked })} className="toggle" />
                  <span>{config.showDefinitions ? 'Yes' : 'No'}</span>
                </label>
              </Field>

              <Field label="Show Illustration Boxes">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={config.showIllustrationBoxes} onChange={(e) => setConfig({ showIllustrationBoxes: e.target.checked })} className="toggle" />
                  <span>{config.showIllustrationBoxes ? 'Yes' : 'No'}</span>
                </label>
              </Field>
            </div>
          </div>
        )}

        {innerTab === 'layout' && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Orientation">
              <div className="flex gap-2">
                {(['portrait', 'landscape'] as const).map((o) => (
                  <button
                    key={o}
                    onClick={() => setConfig({ orientation: o })}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      config.orientation === o ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {o === 'portrait' ? '📄 Portrait' : '📃 Landscape'}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Paper Size">
              <div className="flex gap-2">
                {(['a4', 'letter'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setConfig({ paperSize: s })}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      config.paperSize === s ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {s === 'a4' ? 'A4' : 'Letter'}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Margins (mm)">
              <div className="flex items-center gap-3">
                <input type="range" min={10} max={40} value={config.margins} onChange={(e) => setConfig({ margins: parseInt(e.target.value) })} className="flex-1" />
                <span className="text-sm font-mono w-10 text-right">{config.margins}mm</span>
              </div>
            </Field>

            <Field label="Font Size">
              <div className="flex items-center gap-3">
                <input type="range" min={10} max={28} value={config.fontSize} onChange={(e) => setConfig({ fontSize: parseInt(e.target.value) })} className="flex-1" />
                <span className="text-sm font-mono w-10 text-right">{config.fontSize}pt</span>
              </div>
            </Field>
          </div>
        )}

        {innerTab === 'content' && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Sheet Title">
              <input type="text" value={config.sheetTitle} onChange={(e) => setConfig({ sheetTitle: e.target.value })} className="input-field" />
            </Field>

            <Field label="Show Name Field">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={config.showNameField} onChange={(e) => setConfig({ showNameField: e.target.checked })} className="toggle" />
                <span>{config.showNameField ? 'Visible' : 'Hidden'}</span>
              </label>
            </Field>

            <Field label="Show Date Field">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={config.showDateField} onChange={(e) => setConfig({ showDateField: e.target.checked })} className="toggle" />
                <span>{config.showDateField ? 'Visible' : 'Hidden'}</span>
              </label>
            </Field>

            <Field label="Show Title Field">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={config.showTitleField} onChange={(e) => setConfig({ showTitleField: e.target.checked })} className="toggle" />
                <span>{config.showTitleField ? 'Visible' : 'Hidden'}</span>
              </label>
            </Field>
          </div>
        )}

        {innerTab === 'colors' && (
          <div className="grid grid-cols-2 gap-4">
            <ColorField label="Primary" value={config.primaryColor} onChange={(v) => setConfig({ primaryColor: v })} />
            <ColorField label="Background" value={config.backgroundColor} onChange={(v) => setConfig({ backgroundColor: v })} />
            <ColorField label="Text" value={config.textColor} onChange={(v) => setConfig({ textColor: v })} />
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 p-0" />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="input-field flex-1 font-mono text-xs" />
      </div>
    </Field>
  );
}
