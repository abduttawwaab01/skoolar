'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { FeatureCard, serializeFeatureCards, parseFeatureCards } from '@/lib/school-utils';
import { Plus, Trash2, GraduationCap, Users, BookOpen, Award } from 'lucide-react';

const ICON_OPTIONS = [
  { value: 'GraduationCap', label: 'Graduation', icon: GraduationCap },
  { value: 'Users', label: 'Users', icon: Users },
  { value: 'BookOpen', label: 'Book', icon: BookOpen },
  { value: 'Award', label: 'Award', icon: Award },
  { value: 'Heart', label: 'Heart' },
  { value: 'Star', label: 'Star' },
  { value: 'Globe', label: 'Globe' },
  { value: 'Lightbulb', label: 'Lightbulb' },
  { value: 'Rocket', label: 'Rocket' },
  { value: 'Shield', label: 'Shield' },
  { value: 'Target', label: 'Target' },
  { value: 'Zap', label: 'Zap' },
];

interface FeatureCardsEditorProps {
  value: string;
  onChange: (json: string) => void;
}

const defaultCards: FeatureCard[] = [
  { icon: 'GraduationCap', title: 'Students', description: 'Excellence' },
  { icon: 'Users', title: 'Community', description: 'Together We Grow' },
  { icon: 'BookOpen', title: 'Curriculum', description: 'Comprehensive' },
  { icon: 'Award', title: 'Achievement', description: 'Recognition' },
];

export function FeatureCardsEditor({ value, onChange }: FeatureCardsEditorProps) {
  const cards = parseFeatureCards(value).length > 0 ? parseFeatureCards(value) : defaultCards;

  function updateCard(index: number, field: keyof FeatureCard, val: string) {
    const next = [...cards];
    next[index] = { ...next[index], [field]: val };
    onChange(serializeFeatureCards(next));
  }

  function addCard() {
    const next = [...cards, { icon: 'Star', title: '', description: '' }];
    onChange(serializeFeatureCards(next));
  }

  function removeCard(index: number) {
    const next = cards.filter((_, i) => i !== index);
    onChange(serializeFeatureCards(next));
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">These cards appear on your landing page below the hero section.</p>
      {cards.map((card, i) => (
        <div key={i} className="p-4 border rounded-lg bg-white space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">Card {i + 1}</span>
            {cards.length > 1 && (
              <Button variant="ghost" size="sm" onClick={() => removeCard(i)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Icon</Label>
              <select
                value={card.icon}
                onChange={e => updateCard(i, 'icon', e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                {ICON_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Title</Label>
              <Input value={card.title} onChange={e => updateCard(i, 'title', e.target.value)} placeholder="Card title" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={card.description} onChange={e => updateCard(i, 'description', e.target.value)} placeholder="Short description" />
            </div>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addCard}>
        <Plus className="h-4 w-4 mr-1" /> Add Card
      </Button>
    </div>
  );
}
