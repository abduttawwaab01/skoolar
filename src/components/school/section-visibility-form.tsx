'use client';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { SectionVisibility, parseSectionVisibility, serializeSectionVisibility } from '@/lib/school-utils';

interface SectionVisibilityFormProps {
  value: string;
  onChange: (json: string) => void;
}

const sections: Array<{ key: keyof SectionVisibility; label: string; description: string }> = [
  { key: 'hero', label: 'Hero Section', description: 'Main banner at the top of the landing page' },
  { key: 'featureCards', label: 'Feature Cards', description: 'Icon cards showing key highlights' },
  { key: 'about', label: 'About Section', description: 'About preview on landing page' },
  { key: 'admissions', label: 'Admissions Section', description: 'Admissions CTA on landing page' },
  { key: 'contact', label: 'Contact Page', description: 'The Contact Us page' },
  { key: 'entranceExam', label: 'Entrance Exam Page', description: 'The Entrance Exam page' },
  { key: 'extraSections', label: 'Extra Content Blocks', description: 'Custom blocks you add below' },
];

export function SectionVisibilityForm({ value, onChange }: SectionVisibilityFormProps) {
  const vis = parseSectionVisibility(value);

  function toggle(key: keyof SectionVisibility) {
    const next = { ...vis, [key]: !vis[key] };
    onChange(serializeSectionVisibility(next));
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">Toggle which sections are visible on your public website.</p>
      {sections.map(({ key, label, description }) => (
        <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex-1">
            <Label className="text-sm font-medium">{label}</Label>
            <p className="text-xs text-gray-500">{description}</p>
          </div>
          <Switch checked={vis[key]} onCheckedChange={() => toggle(key)} />
        </div>
      ))}
    </div>
  );
}
