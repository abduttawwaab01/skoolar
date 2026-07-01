'use client';

import { useState } from 'react';
import { useMathDrillStore } from '@/store/math-drill-store';
import {
  TEMPLATE_META,
  DIFFICULTY_RANGES,
  QUESTION_COUNTS,
  COLUMN_OPTIONS,
  type MathDrillTemplateId,
  type MathDrillDifficulty,
  type MathDrillOperation,
} from '@/lib/math-drill-utils';

const INNER_TABS = [
  { id: 'templates', label: 'Templates', icon: '🖼️' },
  { id: 'problems', label: 'Problems', icon: '🔢' },
  { id: 'content', label: 'Content', icon: '📝' },
  { id: 'layout', label: 'Layout', icon: '📐' },
  { id: 'colors', label: 'Colors', icon: '🎨' },
];

export function MathDrillConfigurator() {
  const { config, setConfig, regenerateProblems } = useMathDrillStore();
  const [innerTab, setInnerTab] = useState('templates');

  const handleTemplateSelect = (id: MathDrillTemplateId) => {
    const { TEMPLATE_PRESETS } = require('@/lib/math-drill-utils/templates');
    const preset = TEMPLATE_PRESETS[id];
    if (preset) setConfig(preset);
  };

  const toggleOperation = (op: MathDrillOperation) => {
    const ops = config.operations.includes(op)
      ? config.operations.filter((o) => o !== op)
      : [...config.operations, op];
    if (ops.length === 0) return; // keep at least one
    setConfig({ operations: ops });
  };

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
            {(Object.entries(TEMPLATE_META) as [MathDrillTemplateId, typeof TEMPLATE_META[string]][]).map(([id, meta]) => (
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
                  {id === 'addition-drill' && '➕'}
                  {id === 'subtraction-drill' && '➖'}
                  {id === 'multiplication-drill' && '✖️'}
                  {id === 'division-drill' && '➗'}
                  {id === 'mixed-operations' && '🔀'}
                  {id === 'times-table-drill' && '📊'}
                </div>
                <div className="font-semibold text-sm">{meta.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{meta.description}</div>
              </button>
            ))}
          </div>
        )}

        {innerTab === 'problems' && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Difficulty">
              <div className="flex gap-2">
                {(['easy', 'medium', 'hard'] as MathDrillDifficulty[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setConfig({ difficulty: d })}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      config.difficulty === d ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {d === 'easy' && '🟢 Easy'}
                    {d === 'medium' && '🟡 Medium'}
                    {d === 'hard' && '🔴 Hard'}
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                {DIFFICULTY_RANGES[config.difficulty].label}
              </div>
            </Field>

            {config.templateId === 'mixed-operations' && (
              <Field label="Operations">
                <div className="flex gap-2">
                  {(['+', '-', '×', '÷'] as MathDrillOperation[]).map((op) => (
                    <button
                      key={op}
                      onClick={() => toggleOperation(op)}
                      className={`w-10 h-10 rounded-lg text-lg font-bold border transition-colors ${
                        config.operations.includes(op)
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/50'
                      }`}
                    >
                      {op}
                    </button>
                  ))}
                </div>
              </Field>
            )}

            <Field label="Number of Questions">
              <div className="flex flex-wrap gap-1.5">
                {QUESTION_COUNTS.filter((n) => {
                  if (config.difficulty === 'hard' && n > 30) return false;
                  if (config.difficulty === 'medium' && n > 40) return false;
                  return true;
                }).map((n) => (
                  <button
                    key={n}
                    onClick={() => setConfig({ numberOfQuestions: n })}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                      config.numberOfQuestions === n
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Columns">
              <div className="flex gap-2">
                {COLUMN_OPTIONS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setConfig({ columns: c })}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      config.columns === c ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {c} col{c > 1 ? 's' : ''}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Show Answer Key">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showAnswerKey}
                  onChange={(e) => setConfig({ showAnswerKey: e.target.checked })}
                  className="toggle"
                />
                <span>{config.showAnswerKey ? 'Yes' : 'No'}</span>
              </label>
            </Field>

            <div className="col-span-2 flex justify-center">
              <button onClick={regenerateProblems} className="btn-primary text-sm px-6 py-2">
                🔄 Shuffle & Regenerate Problems
              </button>
            </div>

            <Field label="Include Carrying (Addition)">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includeCarrying}
                  onChange={(e) => setConfig({ includeCarrying: e.target.checked })}
                  className="toggle"
                />
                <span>{config.includeCarrying ? 'Yes' : 'No'}</span>
              </label>
            </Field>

            <Field label="Include Borrowing (Subtraction)">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includeBorrowing}
                  onChange={(e) => setConfig({ includeBorrowing: e.target.checked })}
                  className="toggle"
                />
                <span>{config.includeBorrowing ? 'Yes' : 'No'}</span>
              </label>
            </Field>

            {config.templateId === 'division-drill' && (
              <Field label="Include Remainders">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.includeRemainders}
                    onChange={(e) => setConfig({ includeRemainders: e.target.checked })}
                    className="toggle"
                  />
                  <span>{config.includeRemainders ? 'Yes' : 'No'}</span>
                </label>
              </Field>
            )}

            {config.templateId === 'times-table-drill' && (
              <Field label="Times Table">
                <select
                  value={config.timesTableNumber}
                  onChange={(e) => setConfig({ timesTableNumber: parseInt(e.target.value) })}
                  className="input-field"
                >
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                    <option key={n} value={n}>{n} × Table</option>
                  ))}
                </select>
              </Field>
            )}
          </div>
        )}

        {innerTab === 'content' && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Sheet Title">
              <input
                type="text"
                value={config.sheetTitle}
                onChange={(e) => setConfig({ sheetTitle: e.target.value })}
                className="input-field"
              />
            </Field>

            <Field label="Font Size">
              <div className="flex items-center gap-3">
                <input
                  type="range" min={10} max={28} value={config.fontSize}
                  onChange={(e) => setConfig({ fontSize: parseInt(e.target.value) })}
                  className="flex-1"
                />
                <span className="text-sm font-mono w-10 text-right">{config.fontSize}pt</span>
              </div>
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
