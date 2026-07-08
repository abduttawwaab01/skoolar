'use client';

import { useState, useRef } from 'react';
import { useAttendanceStore } from '@/store/attendance-store';
import {
  TEMPLATE_META,
  type AttendanceTemplateId,
  type AttendanceStudent,
} from '@/lib/attendance-utils';

const INNER_TABS = [
  { id: 'templates', label: 'Templates', icon: '📋' },
  { id: 'students', label: 'Students', icon: '👥' },
  { id: 'content', label: 'Details', icon: '📝' },
  { id: 'layout', label: 'Layout', icon: '📐' },
  { id: 'colors', label: 'Colors', icon: '🎨' },
];

export function AttendanceConfigurator() {
  const { config, setConfig, addStudent, removeStudent, addStudentsBulk, clearStudents } = useAttendanceStore();
  const [innerTab, setInnerTab] = useState('templates');
  const [bulkText, setBulkText] = useState('');
  const [singleName, setSingleName] = useState('');
  const [showBulk, setShowBulk] = useState(false);

  const handleTemplateSelect = (id: AttendanceTemplateId) => {
    const { TEMPLATE_PRESETS } = require('@/lib/attendance-utils/templates');
    const preset = TEMPLATE_PRESETS[id];
    if (preset) {
      setConfig({ ...preset, students: config.students });
    }
  };

  const handleAddSingle = () => {
    const trimmed = singleName.trim();
    if (!trimmed) return;
    addStudent({ id: '', name: trimmed });
    setSingleName('');
  };

  const handleBulkAdd = () => {
    const lines = bulkText.split('\n').filter((l) => l.trim());
    if (lines.length === 0) return;
    addStudentsBulk(lines);
    setBulkText('');
    setShowBulk(false);
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
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
            {(Object.entries(TEMPLATE_META) as [AttendanceTemplateId, typeof TEMPLATE_META[AttendanceTemplateId]][]).map(([id, meta]) => (
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
                  {id === 'standard-register' && '📋'}
                  {id === 'weekly-sheet' && '📄'}
                  {id === 'term-overview' && '📊'}
                  {id === 'behaviour-notes' && '📝'}
                </div>
                <div className="font-semibold text-sm">{meta.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{meta.description}</div>
              </button>
            ))}
          </div>
        )}

        {innerTab === 'students' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Student List ({config.students.length})</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowBulk(!showBulk)}
                  className="btn-ghost text-xs"
                >
                  {showBulk ? 'Single Add' : 'Bulk Paste'}
                </button>
                {config.students.length > 0 && (
                  <button onClick={clearStudents} className="text-xs text-red-500 hover:text-red-700">
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {showBulk ? (
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">
                  Paste one name per line (duplicates will be skipped):
                </label>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={`John Okafor\nMary Adekunle\nChidi Obi\n...`}
                  className="input-field w-full h-32 resize-y font-mono text-sm"
                />
                <button onClick={handleBulkAdd} className="btn-primary text-sm px-4 py-1.5">
                  Add {bulkText.split('\n').filter(l => l.trim()).length > 0 ? `(${bulkText.split('\n').filter(l => l.trim()).length})` : ''} Students
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={singleName}
                  onChange={(e) => setSingleName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddSingle(); }}
                  placeholder="Student name..."
                  className="input-field flex-1"
                />
                <button onClick={handleAddSingle} className="btn-primary text-sm px-3">
                  Add
                </button>
              </div>
            )}

            {config.students.length > 0 && (
              <div className="border rounded-lg max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30 border-b">
                      <th className="text-left px-3 py-1.5 text-xs font-medium text-muted-foreground w-8">#</th>
                      <th className="text-left px-3 py-1.5 text-xs font-medium text-muted-foreground">Name</th>
                      <th className="text-right px-3 py-1.5 w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {config.students.map((s, idx) => (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-3 py-1.5 text-xs text-muted-foreground">{idx + 1}</td>
                        <td className="px-3 py-1.5 text-sm">{s.name}</td>
                        <td className="px-3 py-1.5 text-right">
                          <button
                            onClick={() => removeStudent(s.id)}
                            className="text-xs text-red-400 hover:text-red-600"
                          >
                            Del
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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

            <Field label="Class Name">
              <input
                type="text"
                value={config.className}
                onChange={(e) => setConfig({ className: e.target.value })}
                placeholder="e.g. Primary 3A"
                className="input-field"
              />
            </Field>

            <Field label="Term">
              <select
                value={config.term}
                onChange={(e) => setConfig({ term: e.target.value })}
                className="input-field"
              >
                <option value="1st Term">1st Term</option>
                <option value="2nd Term">2nd Term</option>
                <option value="3rd Term">3rd Term</option>
              </select>
            </Field>

            <Field label="Session">
              <input
                type="text"
                value={config.session}
                onChange={(e) => setConfig({ session: e.target.value })}
                placeholder="e.g. 2025/2026"
                className="input-field"
              />
            </Field>

            <Field label="Start Date">
              <input
                type="date"
                value={config.startDate}
                onChange={(e) => setConfig({ startDate: e.target.value })}
                className="input-field"
              />
            </Field>

            <Field label="End Date">
              <input
                type="date"
                value={config.endDate}
                onChange={(e) => setConfig({ endDate: e.target.value })}
                className="input-field"
              />
            </Field>

            <Field label="Show Summary">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showSummary}
                  onChange={(e) => setConfig({ showSummary: e.target.checked })}
                  className="toggle"
                />
                <span>{config.showSummary ? 'Yes' : 'No'}</span>
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

            {config.templateId === 'behaviour-notes' && (
              <Field label="Behaviour Notes Column" className="col-span-2">
                <div className="text-xs text-muted-foreground">
                  An additional notes column is included for behaviour and comments.
                </div>
              </Field>
            )}
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

            <Field label="Font Size">
              <div className="flex items-center gap-3">
                <input
                  type="range" min={7} max={16} value={config.fontSize}
                  onChange={(e) => setConfig({ fontSize: parseInt(e.target.value) })}
                  className="flex-1"
                />
                <span className="text-sm font-mono w-10 text-right">{config.fontSize}pt</span>
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

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1 ${className}`}>
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
