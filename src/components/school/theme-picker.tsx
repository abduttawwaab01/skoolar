'use client';

import { THEME_PRESETS } from '@/lib/school-utils';
import { Check } from 'lucide-react';

interface ThemePickerProps {
  value: string;
  onChange: (themeName: string) => void;
  onColorsChange: (primary: string, secondary: string) => void;
}

export function ThemePicker({ value, onChange, onColorsChange }: ThemePickerProps) {
  function select(theme: typeof THEME_PRESETS[number]) {
    onChange(theme.name);
    onColorsChange(theme.primary, theme.secondary);
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {THEME_PRESETS.map((theme) => {
        const active = value === theme.name || (!value && theme.name === 'emerald');
        return (
          <button
            key={theme.name}
            type="button"
            onClick={() => select(theme)}
            className={`relative p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${
              active ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-gray-200'
            }`}
          >
            {active && (
              <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                <Check className="h-3 w-3 text-white" />
              </span>
            )}
            <div className="flex gap-2 mb-3">
              <div className="w-6 h-6 rounded-full" style={{ backgroundColor: theme.primary }} />
              <div className="w-6 h-6 rounded-full" style={{ backgroundColor: theme.secondary }} />
            </div>
            <p className="font-semibold text-sm">{theme.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{theme.description}</p>
          </button>
        );
      })}
    </div>
  );
}
