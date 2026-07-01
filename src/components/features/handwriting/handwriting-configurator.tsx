'use client';

import { useState } from 'react';
import { useHandwritingStore } from '@/store/handwriting-store';
import {
  TEMPLATE_META,
  LINE_SPACING_PX,
  LINE_SPACING_LABELS,
  LINE_STYLE_CSS,
  PAPER_DIMENSIONS,
  type HandwritingTemplateId,
  type HandwritingLineSpacing,
  type HandwritingLineStyle,
  type HandwritingOrientation,
  type HandwritingSheetSize,
  type HandwritingContentType,
} from '@/lib/handwriting-utils';

const INNER_TABS = [
  { id: 'templates', label: 'Templates', icon: '🖼️' },
  { id: 'layout', label: 'Layout', icon: '📐' },
  { id: 'content', label: 'Content', icon: '📝' },
  { id: 'colors', label: 'Colors', icon: '🎨' },
  { id: 'story-box', label: 'Story Box', icon: '🖼️' },
];

export function HandwritingConfigurator() {
  const { config, setConfig } = useHandwritingStore();
  const [innerTab, setInnerTab] = useState('templates');

  const handleTemplateSelect = (id: HandwritingTemplateId) => {
    const { TEMPLATE_PRESETS } = require('@/lib/handwriting-utils/templates');
    const preset = TEMPLATE_PRESETS[id];
    if (preset) setConfig(preset);
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
            {(Object.entries(TEMPLATE_META) as [HandwritingTemplateId, typeof TEMPLATE_META[HandwritingTemplateId]][]).map(([id, meta]) => (
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
                  {id === 'classic-ruled' && '📄'}
                  {id === 'dotted-thirds' && '📏'}
                  {id === 'primary-lines' && '✏️'}
                  {id === 'handwriting-grid' && '🔲'}
                  {id === 'trace-write' && '📝'}
                  {id === 'story-sheet' && '📖'}
                </div>
                <div className="font-semibold text-sm">{meta.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{meta.description}</div>
              </button>
            ))}
          </div>
        )}

        {innerTab === 'layout' && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Orientation">
              <div className="flex gap-2">
                {(['portrait', 'landscape'] as HandwritingOrientation[]).map((o) => (
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
                {(['a4', 'letter'] as HandwritingSheetSize[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setConfig({ paperSize: s })}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      config.paperSize === s ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {PAPER_DIMENSIONS[s].label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Line Spacing">
              <select
                value={config.lineSpacing}
                onChange={(e) => setConfig({ lineSpacing: e.target.value as HandwritingLineSpacing })}
                className="input-field"
              >
                {(Object.entries(LINE_SPACING_LABELS) as [HandwritingLineSpacing, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>

            <Field label="Line Style">
              <div className="flex gap-2">
                {(['solid', 'dashed', 'dotted'] as HandwritingLineStyle[]).map((ls) => (
                  <button
                    key={ls}
                    onClick={() => setConfig({ lineStyle: ls })}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      config.lineStyle === ls ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {ls === 'solid' && '━━━'}
                    {ls === 'dashed' && '╌╌╌'}
                    {ls === 'dotted' && '┉┉┉'}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Line Count">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={4}
                  max={30}
                  value={config.lineCount}
                  onChange={(e) => setConfig({ lineCount: parseInt(e.target.value) })}
                  className="flex-1"
                />
                <span className="text-sm font-mono w-8 text-right">{config.lineCount}</span>
              </div>
            </Field>

            <Field label="Show Margin Line">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showMarginLine}
                  onChange={(e) => setConfig({ showMarginLine: e.target.checked })}
                  className="toggle"
                />
                <span>{config.showMarginLine ? 'Yes' : 'No'}</span>
              </label>
            </Field>

            {config.showMarginLine && (
              <Field label="Margin Line Color">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={config.marginLineColor}
                    onChange={(e) => setConfig({ marginLineColor: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                  />
                  <span className="text-xs font-mono">{config.marginLineColor}</span>
                </div>
              </Field>
            )}

            <Field label="Margins (mm)">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={10}
                  max={40}
                  value={config.margins}
                  onChange={(e) => setConfig({ margins: parseInt(e.target.value) })}
                  className="flex-1"
                />
                <span className="text-sm font-mono w-10 text-right">{config.margins}mm</span>
              </div>
            </Field>
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

            <Field label="Content Type">
              <select
                value={config.contentType}
                onChange={(e) => setConfig({ contentType: e.target.value as HandwritingContentType })}
                className="input-field"
              >
                <option value="blank">Blank Lines</option>
                <option value="tracing-text">Tracing Text</option>
                <option value="tracing-letters">Tracing Letters</option>
                <option value="custom-text">Custom Text</option>
              </select>
            </Field>

            <Field label="Show Name Field">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showNameField}
                  onChange={(e) => setConfig({ showNameField: e.target.checked })}
                  className="toggle"
                />
                <span>{config.showNameField ? 'Visible' : 'Hidden'}</span>
              </label>
            </Field>

            <Field label="Show Date Field">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showDateField}
                  onChange={(e) => setConfig({ showDateField: e.target.checked })}
                  className="toggle"
                />
                <span>{config.showDateField ? 'Visible' : 'Hidden'}</span>
              </label>
            </Field>

            <Field label="Show Title Field">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showTitleField}
                  onChange={(e) => setConfig({ showTitleField: e.target.checked })}
                  className="toggle"
                />
                <span>{config.showTitleField ? 'Visible' : 'Hidden'}</span>
              </label>
            </Field>

            <Field label="Font Size">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={10}
                  max={36}
                  value={config.fontSize}
                  onChange={(e) => setConfig({ fontSize: parseInt(e.target.value) })}
                  className="flex-1"
                />
                <span className="text-sm font-mono w-10 text-right">{config.fontSize}pt</span>
              </div>
            </Field>

            {(config.contentType === 'tracing-text' || config.contentType === 'custom-text') && (
              <div className="col-span-2">
                <Field label="Tracing / Custom Text">
                  <textarea
                    value={config.tracingText}
                    onChange={(e) => setConfig({ tracingText: e.target.value })}
                    rows={6}
                    className="input-field w-full font-mono text-sm"
                    placeholder="Enter text to trace..."
                  />
                </Field>
              </div>
            )}
          </div>
        )}

        {innerTab === 'colors' && (
          <div className="grid grid-cols-2 gap-4">
            <ColorField label="Primary" value={config.primaryColor} onChange={(v) => setConfig({ primaryColor: v })} />
            <ColorField label="Line Color" value={config.lineColor} onChange={(v) => setConfig({ lineColor: v })} />
            <ColorField label="Background" value={config.backgroundColor} onChange={(v) => setConfig({ backgroundColor: v })} />
            <ColorField label="Text Color" value={config.textColor} onChange={(v) => setConfig({ textColor: v })} />
          </div>
        )}

        {innerTab === 'story-box' && (
          <div className="space-y-4">
            {config.templateId === 'story-sheet' ? (
              <>
                <Field label="Show Picture Box">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.pictureBox}
                      onChange={(e) => setConfig({ pictureBox: e.target.checked })}
                      className="toggle"
                    />
                    <span>{config.pictureBox ? 'Visible' : 'Hidden'}</span>
                  </label>
                </Field>

                {config.pictureBox && (
                  <Field label="Picture Box Height">
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={80}
                        max={400}
                        value={config.pictureBoxHeight}
                        onChange={(e) => setConfig({ pictureBoxHeight: parseInt(e.target.value) })}
                        className="flex-1"
                      />
                      <span className="text-sm font-mono w-12 text-right">{config.pictureBoxHeight}px</span>
                    </div>
                  </Field>
                )}
              </>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-8">
                Story Box settings only apply to the <strong>Story Sheet</strong> template.
                Please select it from the Templates tab.
              </div>
            )}
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
