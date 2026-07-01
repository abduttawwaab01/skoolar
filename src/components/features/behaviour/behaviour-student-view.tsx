'use client';

import { useBehaviourStore } from '@/store/behaviour-store';
import { StarField } from './stars/star-field';
import { StarButton } from './stars/star-button';
import { motion } from 'framer-motion';
import {
  type StudentBehaviourEntry,
  WEEKDAYS,
  COLOUR_HEX,
  COLOUR_LABELS,
  COLOUR_ORDER_LABELS,
  STICKER_THEMES,
  computeStudentTotal,
  computeStudentMax,
  TEMPLATE_META,
} from '@/lib/behaviour-utils';
import { useState } from 'react';

export function BehaviourStudentView() {
  const { config } = useBehaviourStore();
  const { templateId, students, categories, goals } = config;

  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
        <span className="text-4xl">👤</span>
        <p className="text-sm">No students added yet.</p>
        <p className="text-xs">Go to Configurator → Students to add some.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <div className="text-xs text-muted-foreground mb-2">
        Showing: <strong>{TEMPLATE_META[templateId]?.name || templateId}</strong>
      </div>
      <div className="grid gap-4">
        {students.map((student) => (
          <StudentCard key={student.id} student={student} />
        ))}
      </div>
    </div>
  );
}

function StudentCard({ student }: { student: StudentBehaviourEntry }) {
  const { config, setScore, setColour, setGoalScore } = useBehaviourStore();
  const { templateId, categories, goals, starColor, starSize } = config;
  const [expanded, setExpanded] = useState(false);

  const total = computeStudentTotal(student);
  const max = computeStudentMax(categories);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border rounded-xl bg-card overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
            {student.name.charAt(0).toUpperCase()}
          </div>
          <div className="text-left">
            <div className="font-medium text-sm">{student.name}</div>
            <div className="text-[10px] text-muted-foreground">
              {total} / {max} stars
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex">
            {Array.from({ length: Math.min(total, 5) }).map((_, i) => (
              <StarButton key={i} filled size="sm" color={starColor} />
            ))}
          </div>
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            className="text-muted-foreground text-xs"
          >
            ▼
          </motion.span>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="border-t px-3 py-3 space-y-2"
        >
          {/* Daily star chart / reward-ladder: per category */}
          {(templateId === 'daily-star-chart' || templateId === 'reward-ladder') &&
            categories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{cat.emoji} {cat.label}</span>
                <StarField
                  current={student.scores[cat.id] || 0}
                  max={cat.maxScore}
                  onChange={(v) => setScore(student.id, cat.id, v)}
                  color={starColor}
                  size={starSize}
                />
              </div>
            ))}

          {/* Weekly: per day */}
          {templateId === 'weekly-class-chart' &&
            WEEKDAYS.map((day) => (
              <div key={day} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{day}</span>
                <StarField
                  current={student.scores[day] || 0}
                  max={1}
                  onChange={(v) => setScore(student.id, day, v)}
                  color={starColor}
                  size={starSize}
                />
              </div>
            ))}

          {/* Monthly goal tracker */}
          {templateId === 'monthly-goal-tracker' &&
            goals.map((goal) => (
              <div key={goal.id} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{goal.emoji} {goal.label}</span>
                <StarField
                  current={(student.goals || {})[goal.id] || 0}
                  max={1}
                  onChange={(v) => setGoalScore(student.id, goal.id, v)}
                  color={starColor}
                  size={starSize}
                />
              </div>
            ))}

          {/* Colour behaviour chart */}
          {templateId === 'colour-behaviour-chart' && (
            <div className="flex items-center justify-center gap-2 py-1">
              {COLOUR_ORDER_LABELS.map((c) => {
                const selected = (student.colour || 'grey') === c;
                return (
                  <button
                    key={c}
                    onClick={() => setColour(student.id, c)}
                    className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all ${
                      selected ? 'ring-2 ring-offset-1 ring-foreground scale-105 bg-muted/50' : 'opacity-50 hover:opacity-80'
                    }`}
                  >
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs text-white font-bold"
                      style={{ backgroundColor: COLOUR_HEX[c] }}
                    >
                      {selected ? '✓' : ''}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{COLOUR_LABELS[c]}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Sticker collection */}
          {templateId === 'sticker-collection' && (
            <div className="grid grid-cols-5 gap-2 py-1">
              {Array.from({ length: 15 }).map((_, i) => {
                const filled = i < (student.scores['collected'] || 0);
                const theme = STICKER_THEMES[config.stickerTheme];
                return (
                  <button
                    key={i}
                    onClick={() => setScore(student.id, 'collected', filled ? i : i + 1)}
                    className={`aspect-square rounded-full flex items-center justify-center text-lg border-2 transition-all ${
                      filled
                        ? 'border-solid scale-100'
                        : 'border-dashed opacity-40 hover:opacity-70'
                    }`}
                    style={{
                      borderColor: theme?.circleBorder || '#cbd5e1',
                      backgroundColor: filled ? (theme?.bgColor || '#f8fafc') : 'transparent',
                    }}
                  >
                    {filled ? (['🚀', '🌙', '⭐', '🛸', '☄️', '🪐', '🌍', '💫'][i % 8]) : '?'}
                  </button>
                );
              })}
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
