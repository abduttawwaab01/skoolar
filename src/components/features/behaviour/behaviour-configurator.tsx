'use client';

import { useState, useEffect, useCallback } from 'react';
import { useBehaviourStore } from '@/store/behaviour-store';
import { StarField } from './stars/star-field';
import { COLOUR_GRADIENTS, getColourHex, colourToScore } from '@/lib/behaviour-utils/colour-helpers';
import {
  type BehaviourCategory,
  type ColourState,
  type BehaviourGoal,
  type BehaviourReward,
  CATEGORY_PRESETS,
  COLOUR_HEX,
  COLOUR_LABELS,
  COLOUR_ORDER_LABELS,
  WEEKDAYS,
  STICKER_THEMES,
  DEFAULT_GOALS,
  renderChartHTML,
  TEMPLATE_META,
} from '@/lib/behaviour-utils';
import { renderChartHTML as renderHtml } from '@/lib/behaviour-utils/render-chart';

interface ConfigTabProps {
  label: string;
  icon: string;
  tab: string;
}
const CONFIG_TABS: ConfigTabProps[] = [
  { label: 'Content', icon: '📝', tab: 'content' },
  { label: 'Students', icon: '👥', tab: 'students' },
  { label: 'Categories', icon: '🏷️', tab: 'categories' },
  { label: 'Design', icon: '🎨', tab: 'design' },
  { label: 'Rewards', icon: '🏆', tab: 'rewards' },
  { label: 'Templates', icon: '🖼️', tab: 'templates' },
];

function generateId(): string {
  return `g${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
}

export function BehaviourConfigurator() {
  const { config, setConfig, setCategories, loadCategoryPreset, setScore, setColour, setGoalScore, addStudent, removeStudent } = useBehaviourStore();
  const [activeInnerTab, setActiveInnerTab] = useState('content');
  const [newStudentName, setNewStudentName] = useState('');
  const [newGoalLabel, setNewGoalLabel] = useState('');
  const [newRewardLabel, setNewRewardLabel] = useState('');
  const [newRewardThreshold, setNewRewardThreshold] = useState(10);

  const handleScoreChange = useCallback(
    (studentId: string, categoryId: string, value: number) => {
      setScore(studentId, categoryId, value);
    },
    [setScore]
  );

  const handleColourChange = useCallback(
    (studentId: string, colour: ColourState) => {
      setColour(studentId, colour);
    },
    [setColour]
  );

  const handleAddStudent = useCallback(() => {
    if (!newStudentName.trim()) return;
    addStudent(newStudentName.trim());
    setNewStudentName('');
  }, [newStudentName, addStudent]);

  const handleAddGoal = useCallback(() => {
    if (!newGoalLabel.trim()) return;
    const goal: BehaviourGoal = { id: generateId(), label: newGoalLabel.trim(), emoji: '🎯' };
    setConfig({ goals: [...config.goals, goal] });
    setNewGoalLabel('');
  }, [newGoalLabel, config.goals, setConfig]);

  const handleAddReward = useCallback(() => {
    if (!newRewardLabel.trim()) return;
    const reward: BehaviourReward = { threshold: newRewardThreshold, label: newRewardLabel.trim(), emoji: '🎁' };
    setConfig({ rewards: [...config.rewards, reward].sort((a, b) => a.threshold - b.threshold) });
    setNewRewardLabel('');
    setNewRewardThreshold(reward.threshold + 10);
  }, [newRewardLabel, newRewardThreshold, config.rewards, setConfig]);

  const handleTemplateLoad = useCallback(
    (templateId: string) => {
      const { TEMPLATE_PRESETS } = require('@/lib/behaviour-utils/templates');
      const preset = TEMPLATE_PRESETS[templateId];
      if (preset) {
        setConfig(preset);
        setCategories(preset.categories);
      }
    },
    [setConfig, setCategories]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Inner tab bar */}
      <div className="flex gap-1 p-2 bg-muted/30 rounded-t-lg border-b overflow-x-auto">
        {CONFIG_TABS.map((t) => (
          <button
            key={t.tab}
            onClick={() => setActiveInnerTab(t.tab)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              activeInnerTab === t.tab
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted/50'
            }`}
          >
            <span className="text-base">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Panels */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {activeInnerTab === 'content' && <ContentPanel />}
        {activeInnerTab === 'students' && (
          <StudentsPanel
            newStudentName={newStudentName}
            setNewStudentName={setNewStudentName}
            handleAddStudent={handleAddStudent}
          />
        )}
        {activeInnerTab === 'categories' && (
          <CategoriesPanel
            newGoalLabel={newGoalLabel}
            setNewGoalLabel={setNewGoalLabel}
            handleAddGoal={handleAddGoal}
            handleTemplateLoad={handleTemplateLoad}
          />
        )}
        {activeInnerTab === 'design' && <DesignPanel />}
        {activeInnerTab === 'rewards' && (
          <RewardsPanel
            newRewardLabel={newRewardLabel}
            setNewRewardLabel={setNewRewardLabel}
            newRewardThreshold={newRewardThreshold}
            setNewRewardThreshold={setNewRewardThreshold}
            handleAddReward={handleAddReward}
          />
        )}
        {activeInnerTab === 'templates' && <TemplateGalleryPanel onSelect={handleTemplateLoad} />}
      </div>
    </div>
  );
}

/* ───── Content Panel ───── */
function ContentPanel() {
  const { config, setConfig } = useBehaviourStore();
  return (
    <div className="grid grid-cols-2 gap-4">
      <Field label="Chart Title">
        <input type="text" value={config.chartTitle} onChange={(e) => setConfig({ chartTitle: e.target.value })} className="input-field" />
      </Field>
      <Field label="School Name">
        <input type="text" value={config.schoolName} onChange={(e) => setConfig({ schoolName: e.target.value })} className="input-field" />
      </Field>
      <Field label="Period Label">
        <input type="text" value={config.periodLabel} onChange={(e) => setConfig({ periodLabel: e.target.value })} className="input-field" />
      </Field>
      <Field label="Date">
        <input type="date" value={config.date} onChange={(e) => setConfig({ date: e.target.value })} className="input-field" />
      </Field>
      <Field label="Period Type">
        <select value={config.periodType} onChange={(e) => setConfig({ periodType: e.target.value as any })} className="input-field">
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </Field>
      <Field label="Show Student Names">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={config.showNames} onChange={(e) => setConfig({ showNames: e.target.checked })} className="toggle" />
          <span>{config.showNames ? 'Visible' : 'Hidden'}</span>
        </label>
      </Field>
      <Field label="Show Totals">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={config.showTotals} onChange={(e) => setConfig({ showTotals: e.target.checked })} className="toggle" />
          <span>{config.showTotals ? 'Visible' : 'Hidden'}</span>
        </label>
      </Field>
      <Field label="Show Reward Track">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={config.showRewardTrack} onChange={(e) => setConfig({ showRewardTrack: e.target.checked })} className="toggle" />
          <span>{config.showRewardTrack ? 'Visible' : 'Hidden'}</span>
        </label>
      </Field>
    </div>
  );
}

/* ───── Students Panel ───── */
function StudentsPanel({
  newStudentName,
  setNewStudentName,
  handleAddStudent,
}: {
  newStudentName: string;
  setNewStudentName: (v: string) => void;
  handleAddStudent: () => void;
}) {
  const { config, setScore, setColour, setGoalScore, removeStudent } = useBehaviourStore();
  const { templateId } = config;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={newStudentName}
          onChange={(e) => setNewStudentName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddStudent()}
          placeholder="Enter student name..."
          className="input-field flex-1"
        />
        <button onClick={handleAddStudent} className="btn-primary">Add</button>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {config.students.map((student) => (
          <div key={student.id} className="p-3 border rounded-lg bg-card space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">{student.name}</span>
              <button
                onClick={() => removeStudent(student.id)}
                className="text-xs text-red-500 hover:text-red-700 px-2 py-0.5 rounded hover:bg-red-50"
              >
                Remove
              </button>
            </div>

            {/* Star scores per category */}
            {templateId !== 'colour-behaviour-chart' && templateId !== 'sticker-collection' && config.categories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-2">
                <span className="text-xs w-24 truncate text-muted-foreground">{cat.emoji} {cat.label}</span>
                <StarField
                  current={student.scores[cat.id] || 0}
                  max={cat.maxScore}
                  onChange={(v) => setScore(student.id, cat.id, v)}
                  size="sm"
                />
                <span className="text-xs text-muted-foreground w-8 text-right">{student.scores[cat.id] || 0}/{cat.maxScore}</span>
              </div>
            ))}

            {/* Weekly: per day */}
            {templateId === 'weekly-class-chart' && WEEKDAYS.map((day) => (
              <div key={day} className="flex items-center gap-2">
                <span className="text-xs w-16 truncate text-muted-foreground">{day}</span>
                <StarField
                  current={student.scores[day] || 0}
                  max={5}
                  onChange={(v) => setScore(student.id, day, v)}
                  size="sm"
                />
              </div>
            ))}

            {/* Colour behaviour chart */}
            {templateId === 'colour-behaviour-chart' && (
              <div className="flex items-center gap-2">
                {COLOUR_ORDER_LABELS.map((c) => {
                  const current = student.colour || 'grey';
                  const selected = c === current;
                  return (
                    <button
                      key={c}
                      onClick={() => setColour(student.id, c)}
                      className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${
                        selected ? 'ring-2 ring-offset-2 ring-foreground scale-110' : 'opacity-50 hover:opacity-80'
                      }`}
                      style={{ backgroundColor: COLOUR_HEX[c], color: '#fff' }}
                      title={COLOUR_LABELS[c]}
                    >
                      {selected ? '✓' : ''}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Goal tracker per student */}
            {templateId === 'monthly-goal-tracker' && config.goals.map((goal) => (
              <div key={goal.id} className="flex items-center gap-2">
                <span className="text-xs w-24 truncate text-muted-foreground">{goal.emoji} {goal.label}</span>
                <StarField
                  current={(student.goals || {})[goal.id] || 0}
                  max={1}
                  onChange={(v) => setGoalScore(student.id, goal.id, v)}
                  size="sm"
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───── Categories Panel ───── */
function CategoriesPanel({
  newGoalLabel,
  setNewGoalLabel,
  handleAddGoal,
  handleTemplateLoad,
}: {
  newGoalLabel: string;
  setNewGoalLabel: (v: string) => void;
  handleAddGoal: () => void;
  handleTemplateLoad: (id: string) => void;
}) {
  const { config, setConfig, setCategories, loadCategoryPreset } = useBehaviourStore();
  const { templateId } = config;

  return (
    <div className="space-y-6">
      {/* Category presets */}
      <div>
        <Label>Category Presets</Label>
        <div className="grid grid-cols-3 gap-2 mt-1">
          {Object.entries(CATEGORY_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => loadCategoryPreset(key)}
              className={`p-2 rounded-lg border text-sm text-left transition-colors ${
                config.categoryPreset === key
                  ? 'border-primary bg-primary/10'
                  : 'hover:border-primary/50'
              }`}
            >
              <div className="font-medium">{preset.label}</div>
              <div className="text-xs text-muted-foreground">{preset.categories.length} categories</div>
            </button>
          ))}
        </div>
      </div>

      {/* Individual category max scores */}
      {config.categories.length > 0 && (
        <div>
          <Label>Category Max Scores</Label>
          <div className="space-y-1.5 mt-1">
            {config.categories.map((cat, idx) => (
              <div key={cat.id} className="flex items-center gap-3">
                <span className="text-lg">{cat.emoji}</span>
                <span className="text-sm flex-1">{cat.label}</span>
                <select
                  value={cat.maxScore}
                  onChange={(e) => {
                    const updated = [...config.categories];
                    updated[idx] = { ...updated[idx], maxScore: parseInt(e.target.value) };
                    setCategories(updated);
                  }}
                  className="input-field w-20"
                >
                  {[1, 2, 3, 5, 10].map((n) => (
                    <option key={n} value={n}>{n} stars</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Goals (monthly-goal-tracker) */}
      {templateId === 'monthly-goal-tracker' && (
        <div>
          <Label>Goals</Label>
          <div className="flex gap-2 mt-1">
            <input
              type="text"
              value={newGoalLabel}
              onChange={(e) => setNewGoalLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddGoal()}
              placeholder="New goal..."
              className="input-field flex-1"
            />
            <button onClick={handleAddGoal} className="btn-primary text-sm">Add</button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {config.goals.map((goal, idx) => (
              <span key={goal.id} className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-full text-xs">
                {goal.emoji} {goal.label}
                <button
                  onClick={() => setConfig({ goals: config.goals.filter((_, i) => i !== idx) })}
                  className="text-red-400 hover:text-red-600 ml-1"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ───── Design Panel ───── */
function DesignPanel() {
  const { config, setConfig } = useBehaviourStore();

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <ColorField label="Primary" value={config.primaryColor} onChange={(v) => setConfig({ primaryColor: v })} />
        <ColorField label="Secondary" value={config.secondaryColor} onChange={(v) => setConfig({ secondaryColor: v })} />
        <ColorField label="Accent" value={config.accentColor} onChange={(v) => setConfig({ accentColor: v })} />
        <ColorField label="Background" value={config.backgroundColor} onChange={(v) => setConfig({ backgroundColor: v })} />
        <ColorField label="Text" value={config.textColor} onChange={(v) => setConfig({ textColor: v })} />
        <ColorField label="Border" value={config.borderColor} onChange={(v) => setConfig({ borderColor: v })} />
        <ColorField label="Star Color" value={config.starColor} onChange={(v) => setConfig({ starColor: v })} />
      </div>

      <div className="flex items-center gap-4">
        <Label>Star Size</Label>
        {(['sm', 'md', 'lg'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setConfig({ starSize: s })}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              config.starSize === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {s.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Sticker theme (only for sticker-collection) */}
      {config.templateId === 'sticker-collection' && (
        <div>
          <Label>Sticker Theme</Label>
          <div className="flex gap-2 mt-1">
            {(Object.entries(STICKER_THEMES) as [string, typeof STICKER_THEMES.space][]).map(([key, theme]) => (
              <button
                key={key}
                onClick={() => setConfig({ stickerTheme: key as any })}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                  config.stickerTheme === key ? 'border-primary bg-primary/10' : 'hover:border-primary/50'
                }`}
              >
                <span className="text-lg">{theme.emoji}</span>
                {theme.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Colour cycle order (only for colour-behaviour-chart) */}
      {config.templateId === 'colour-behaviour-chart' && (
        <div>
          <Label>Colour Cycle Order</Label>
          <div className="flex gap-2 mt-1">
            {COLOUR_ORDER_LABELS.map((c, idx) => (
              <span
                key={c}
                className="flex items-center gap-1 px-3 py-1 rounded-full text-xs text-white font-medium"
                style={{ backgroundColor: COLOUR_HEX[c] }}
              >
                {idx + 1}. {COLOUR_LABELS[c]}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ───── Rewards Panel ───── */
function RewardsPanel({
  newRewardLabel,
  setNewRewardLabel,
  newRewardThreshold,
  setNewRewardThreshold,
  handleAddReward,
}: {
  newRewardLabel: string;
  setNewRewardLabel: (v: string) => void;
  newRewardThreshold: number;
  setNewRewardThreshold: (v: number) => void;
  handleAddReward: () => void;
}) {
  const { config, setConfig } = useBehaviourStore();

  return (
    <div className="space-y-4">
      <Field label="Enable Reward Track">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.showRewardTrack}
            onChange={(e) => setConfig({ showRewardTrack: e.target.checked })}
            className="toggle"
          />
          <span>{config.showRewardTrack ? 'On' : 'Off'}</span>
        </label>
      </Field>

      {config.showRewardTrack && (
        <>
          <div className="flex gap-2">
            <input
              type="text"
              value={newRewardLabel}
              onChange={(e) => setNewRewardLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddReward()}
              placeholder="Reward label..."
              className="input-field flex-1"
            />
            <input
              type="number"
              value={newRewardThreshold}
              onChange={(e) => setNewRewardThreshold(parseInt(e.target.value) || 10)}
              className="input-field w-24"
              min={1}
            />
            <button onClick={handleAddReward} className="btn-primary text-sm">Add</button>
          </div>

          <div className="space-y-1">
            {config.rewards.map((r, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2 border rounded-lg">
                <span className="text-lg">{r.emoji || '🎁'}</span>
                <span className="flex-1 text-sm">{r.label}</span>
                <span className="text-xs text-muted-foreground">{r.threshold} stars</span>
                <button
                  onClick={() => setConfig({ rewards: config.rewards.filter((_, i) => i !== idx) })}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ───── Template Gallery Panel ───── */
function TemplateGalleryPanel({ onSelect }: { onSelect: (id: string) => void }) {
  const { config } = useBehaviourStore();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {Object.entries(TEMPLATE_META).map(([id, meta]) => (
        <button
          key={id}
          onClick={() => onSelect(id)}
          className={`p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${
            config.templateId === id
              ? 'border-primary bg-primary/5 shadow-sm'
              : 'border-border hover:border-primary/50'
          }`}
        >
          <div className="text-3xl mb-2">
            {id === 'daily-star-chart' && '⭐'}
            {id === 'weekly-class-chart' && '📅'}
            {id === 'monthly-goal-tracker' && '🎯'}
            {id === 'colour-behaviour-chart' && '🎨'}
            {id === 'reward-ladder' && '🏆'}
            {id === 'sticker-collection' && '🪐'}
          </div>
          <div className="font-semibold text-sm">{meta.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{meta.description}</div>
          <div className="text-[10px] text-muted-foreground/60 mt-1">Best: {meta.bestFor}</div>
        </button>
      ))}
    </div>
  );
}

/* ───── Helpers ───── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium text-muted-foreground">{children}</label>;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border-0 p-0"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input-field flex-1 font-mono text-xs"
        />
      </div>
    </div>
  );
}
